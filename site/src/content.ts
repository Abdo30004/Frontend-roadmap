import { useEffect, useState } from 'react';
import { CATALOG, CATEGORIES, LEVELS, type CategoryId, type Level } from './catalog';

// Question markdown, one lazy chunk per file. The .md files stay the single source of truth.
const RAW = import.meta.glob('../../content/*/*.md', { query: '?raw', import: 'default' }) as Record<
  string,
  () => Promise<string>
>;

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
export const questionId = (q: Pick<QuestionMeta, 'level' | 'slug'>) => `${q.level}/${q.slug}`;

type Section = 'concept' | 'problem' | 'fix' | 'interview';

function parse(md: string) {
  const text = md.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const title = (lines.find((l) => l.startsWith('# ')) ?? '').slice(2).trim();

  const merged: string[] = [];
  const mi = lines.findIndex((l) => l.startsWith('**Merged from'));
  if (mi >= 0) {
    for (let i = mi + 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.startsWith('- ')) merged.push(l.slice(2).trim());
      else if (l.trim() === '' && merged.length === 0) continue;
      else break;
    }
  }

  const sections: Partial<Record<Section, string>> = {};
  for (const part of text.split(/^## /m).slice(1)) {
    const nl = part.indexOf('\n');
    const heading = part.slice(0, nl).toLowerCase();
    const body = part.slice(nl + 1).trim();
    if (heading.startsWith('the concept')) sections.concept = body;
    else if (heading.startsWith('real-life')) sections.problem = body;
    else if (heading.startsWith('how to fix')) sections.fix = body;
    else if (heading.startsWith('how to say')) sections.interview = body;
  }
  return { title, merged, ...sections };
}

const cache = new Map<Level, Promise<Question[]>>();

export function loadLevel(level: Level): Promise<Question[]> {
  let p = cache.get(level);
  if (!p) {
    p = Promise.all(
      META[level].map(async (m) => {
        const loader = RAW[`../../content/${level}/${m.slug}.md`];
        const parsed = parse(loader ? await loader() : `# ${m.short}`);
        return {
          ...m,
          title: parsed.title || m.short,
          merged: parsed.merged,
          concept: parsed.concept ?? '',
          problem: parsed.problem ?? '',
          fix: parsed.fix ?? '',
          interview: parsed.interview ?? '',
        };
      }),
    );
    cache.set(level, p);
  }
  return p;
}

export function useLevel(level: Level) {
  const [data, setData] = useState<Question[] | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    loadLevel(level).then((qs) => alive && setData(qs));
    return () => {
      alive = false;
    };
  }, [level]);
  return data;
}
