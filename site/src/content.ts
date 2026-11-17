import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CATALOG, CATEGORIES, LEVELS, type CategoryId, type Level } from './catalog';
import { useLang, type Lang } from './i18n';
import { parseQuestion as parse } from './parse';

// Question markdown, one lazy chunk per file. The .md files stay the single source of truth.
const RAW = import.meta.glob('../../content/*/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
// French translations mirror the same layout under content/fr/<level>/<slug>.md.
const RAW_FR = import.meta.glob('../../content/fr/*/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

/** Lightweight metadata from the catalog — enough for the map and the sidebar. */
export interface QuestionMeta {
  level: Level;
  slug: string;
  num: number;
  short: string;
  category: CategoryId;
}

export interface Question extends QuestionMeta {
  title: string;
  merged: string[];
  concept: string;
  problem: string;
  fix: string;
  interview: string;
  /** false when French was asked for but only the English file exists. */
  translated: boolean;
}

export const META: Record<Level, QuestionMeta[]> = {
  junior: [],
  mid: [],
  senior: [],
};
for (const { id: level } of LEVELS) {
  META[level] = CATALOG[level].map(([slug, short, category]) => ({ level, slug, num: parseInt(slug, 10), short, category }));
}
export const ALL_META = LEVELS.flatMap((l) => META[l.id]);

export const categoryLabel = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

/** Localized labels for levels, categories and the short map names of questions. */
export function useLabels() {
  const { t } = useTranslation();
  return {
    level: (id: Level) => t(`level.${id}.label`),
    levelTitle: (id: Level) => t(`level.${id}.title`),
    blurb: (id: Level) => t(`level.${id}.blurb`),
    category: (id: CategoryId) => t(`category.${id}`, { defaultValue: categoryLabel(id) }),
    short: (q: QuestionMeta) => t(`short.${questionId(q)}`, { defaultValue: q.short }),
  };
}
export const questionId = (q: Pick<QuestionMeta, 'level' | 'slug'>) => `${q.level}/${q.slug}`;

const cache = new Map<string, Promise<Question[]>>();

export function loadLevel(level: Level, lang: Lang = 'en'): Promise<Question[]> {
  const key = `${lang}:${level}`;
  let p = cache.get(key);
  if (!p) {
    p = Promise.all(
      META[level].map(async (m) => {
        const frLoader = lang === 'fr' ? RAW_FR[`../../content/fr/${level}/${m.slug}.md`] : undefined;
        const loader = frLoader ?? RAW[`../../content/${level}/${m.slug}.md`];
        const parsed = parse(loader ? await loader() : `# ${m.short}`);
        return {
          ...m,
          title: parsed.title || m.short,
          merged: parsed.merged,
          concept: parsed.concept ?? '',
          problem: parsed.problem ?? '',
          fix: parsed.fix ?? '',
          interview: parsed.interview ?? '',
          translated: lang === 'en' || !!frLoader,
        };
      }),
    );
    cache.set(key, p);
  }
  return p;
}

export function useLevel(level: Level) {
  const lang = useLang();
  const [data, setData] = useState<Question[] | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    loadLevel(level, lang).then((qs) => alive && setData(qs));
    return () => {
      alive = false;
    };
  }, [level, lang]);
  return data;
}
