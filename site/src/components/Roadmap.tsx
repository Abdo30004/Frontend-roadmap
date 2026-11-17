// The interactive learning map on the home page.
// Level (centre) -> topics (the catalog categories) -> the platform's own questions.
// Click a topic to show its questions; click a question to go to it.
// Data-driven: everything comes from catalog.ts / content.ts, nothing is hard-coded per topic.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CATEGORIES, LEVELS, type CategoryId, type Level } from '../catalog';
import { META, questionId, useLabels, type QuestionMeta } from '../content';
import { useLang } from '../i18n';
import { useProgress, type Status } from '../progress';
import TITLES from '../generated/titles.json';
import { CheckIcon } from './Icons';
import { TopicIcon } from './TopicIcon';

interface Topic {
  id: CategoryId;
  concepts: QuestionMeta[];
}

const topicsFor = (level: Level): Topic[] =>
  CATEGORIES.map((c) => ({ id: c.id, concepts: META[level].filter((q) => q.category === c.id) })).filter((t) => t.concepts.length > 0);

/** A topic (or level) is completed when all its questions are, started when any question is. */
function rollup(statuses: Status[]): Status {
  if (statuses.length && statuses.every((s) => s === 'completed')) return 'completed';
  return statuses.some((s) => s !== 'not_started') ? 'in_progress' : 'not_started';
}

/** The interview question itself (the question's title), in the current language. */
function useQuestionText() {
  const lang = useLang();
  const all = TITLES as Record<'en' | 'fr', Record<string, string>>;
  return (q: QuestionMeta) => all[lang][questionId(q)] ?? all.en[questionId(q)] ?? q.short;
}

const questionHref = (q: QuestionMeta) => `/${q.level}#${q.slug}`;

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <span className="rm-bar" aria-hidden>
      <span style={{ transform: `scaleX(${total ? done / total : 0})` }} />
    </span>
  );
}

function StatusLabel({ s }: { s: Status }) {
  const { t } = useTranslation();
  return (
    <span className="rm-status" data-s={s}>
      {s === 'completed' && <CheckIcon size={12} />}
      {t(`roadmap.status.${s}`)}
    </span>
  );
}

function TopicSummary({ tp }: { tp: Topic }) {
  const { t } = useTranslation();
  const label = useLabels();
  const { status } = useProgress();
  const s = tp.concepts.map((q) => status(questionId(q)));
  const done = s.filter((x) => x === 'completed').length;
  return (
    <>
      <span className="rm-topic-icon">
        <TopicIcon id={tp.id} />
      </span>
      <span className="rm-topic-text">
        <strong>{label.category(tp.id)}</strong>
        <span className="rm-topic-meta rm-topic-meta-3">
          <StatusLabel s={rollup(s)} />
          <Progress done={done} total={s.length} />
          <span>{t('roadmap.count', { done, total: s.length })}</span>
        </span>
      </span>
    </>
  );
}

const topicState = (tp: Topic, status: (id: string) => Status) => rollup(tp.concepts.map((q) => status(questionId(q))));

/* ------------------------------------------------------------ small screens: question card */

function QuestionCard({ q, index }: { q: QuestionMeta; index: number }) {
  const label = useLabels();
  const question = useQuestionText();
  const { status, markOpened } = useProgress();
  const id = questionId(q);
  const s = status(id);
  return (
    <li className="rm-concept" data-s={s} style={{ ['--i' as string]: index }}>
      <Link to={questionHref(q)} onClick={() => markOpened(id)}>
        <span className="rm-concept-top">
          <strong>{label.short(q)}</strong>
          <StatusLabel s={s} />
        </span>
        <span className="rm-concept-q">{question(q)}</span>
      </Link>
    </li>
  );
}

/* ------------------------------------------------------------ one level: a mind map */

type Side = 'top' | 'bottom' | 'left' | 'right';
type Edge = { key: string; d: string; topic: string; kind: 'hub' | 'leaf'; s?: Status };

/**
 * Place topics around the level: the two smallest go above and below (their questions sit in a row),
 * the rest split left and right so both sides carry about the same number of questions.
 */
function arrange(topics: Topic[]): Record<Side, Topic[]> {
  if (topics.length < 4) {
    const half = Math.ceil(topics.length / 2);
    return { top: [], bottom: [], left: topics.slice(0, half), right: topics.slice(half) };
  }
  const bySize = [...topics].sort((a, b) => a.concepts.length - b.concepts.length);
  const top = bySize[0];
  const bottom = bySize[1];
  const left: Topic[] = [];
  const right: Topic[] = [];
  let l = 0;
  let r = 0;
  for (const tp of topics) {
    if (tp === top || tp === bottom) continue;
    if (l <= r) {
      left.push(tp);
      l += tp.concepts.length + 1;
    } else {
      right.push(tp);
      r += tp.concepts.length + 1;
    }
  }
  return { top: [top], bottom: [bottom], left, right };
}

function Chip({ q, index, onHot }: { q: QuestionMeta; index: number; onHot: (id: string | null) => void }) {
  const label = useLabels();
  const question = useQuestionText();
  const { status, markOpened } = useProgress();
  const id = questionId(q);
  const s = status(id);
  return (
    <Link
      to={questionHref(q)}
      className="mm-chip"
      data-chip-of={q.category}
      data-chip={q.slug}
      data-s={s}
      title={question(q)}
      style={{ ['--i' as string]: index }}
      onClick={() => markOpened(id)}
      onMouseEnter={() => onHot(q.category)}
      onMouseLeave={() => onHot(null)}
      onFocus={() => onHot(q.category)}
      onBlur={() => onHot(null)}
    >
      {s === 'completed' && <CheckIcon size={13} />}
      <span>{label.short(q)}</span>
    </Link>
  );
}

function LevelMap({ level }: { level: Level }) {
  const { t } = useTranslation();
  const label = useLabels();
  const lang = useLang();
  const { status } = useProgress();

  const topics = useMemo(() => topicsFor(level), [level]);
  const sides = useMemo(() => arrange(topics), [topics]);
  const levelStatuses = META[level].map((q) => status(questionId(q)));
  const levelDone = levelStatuses.filter((s) => s === 'completed').length;

  // Which topics show their questions. All closed at first: click a topic to open it.
  const [open, setOpen] = useState<CategoryId[]>([]);
  const toggle = (id: CategoryId) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  // Highlight one branch while hovering or focusing its topic or one of its questions.
  const [hot, setHot] = useState<string | null>(null);

  /* ---- curved connectors, from the level outwards in all four directions ---- */
  const mapRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<{ list: Edge[]; w: number; h: number }>({ list: [], w: 0, h: 0 });

  const measure = useCallback(() => {
    const m = mapRef.current;
    if (!m || m.offsetParent === null) return; // hidden on small screens
    const box = m.getBoundingClientRect();
    const R = (el: Element) => {
      const r = el.getBoundingClientRect();
      return {
        l: r.left - box.left,
        r: r.right - box.left,
        t: r.top - box.top,
        b: r.bottom - box.top,
        cx: (r.left + r.right) / 2 - box.left,
        cy: (r.top + r.bottom) / 2 - box.top,
      };
    };
    const H = (x1: number, y1: number, x2: number, y2: number) => {
      const c = (x2 - x1) / 2;
      return `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`;
    };
    const V = (x1: number, y1: number, x2: number, y2: number) => {
      const c = (y2 - y1) / 2;
      return `M${x1},${y1} C${x1},${y1 + c} ${x2},${y2 - c} ${x2},${y2}`;
    };

    const hubEl = m.querySelector('[data-hub]');
    if (!hubEl) return;
    const hub = R(hubEl);
    const list: Edge[] = [];
    m.querySelectorAll<HTMLElement>('[data-topic]').forEach((el) => {
      const id = el.dataset.topic!;
      const side = el.dataset.side as Side;
      const tp = R(el);
      const toTopic = {
        left: () => H(hub.l, hub.cy, tp.r, tp.cy),
        right: () => H(hub.r, hub.cy, tp.l, tp.cy),
        top: () => V(hub.cx, hub.t, tp.cx, tp.b),
        bottom: () => V(hub.cx, hub.b, tp.cx, tp.t),
      }[side];
      list.push({ key: `h-${id}`, d: toTopic(), topic: id, kind: 'hub' });
      m.querySelectorAll<HTMLElement>(`[data-chip-of="${id}"]`).forEach((chipEl) => {
        const c = R(chipEl);
        const d = {
          left: () => H(tp.l, tp.cy, c.r, c.cy),
          right: () => H(tp.r, tp.cy, c.l, c.cy),
          top: () => V(tp.cx, tp.t, c.cx, c.b),
          bottom: () => V(tp.cx, tp.b, c.cx, c.t),
        }[side]();
        list.push({ key: `c-${chipEl.dataset.chip}`, d, topic: id, kind: 'leaf', s: chipEl.dataset.s as Status });
      });
    });
    setEdges({ list, w: m.clientWidth, h: m.clientHeight });
  }, []);

  useLayoutEffect(measure, [measure, lang, levelStatuses.join(), open]);
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(m);
    document.fonts?.ready.then(() => measure());
    return () => ro.disconnect();
  }, [measure]);

  const group = (tp: Topic, side: Side) => {
    const isOpen = open.includes(tp.id);
    const chips = isOpen && (
      <div className="mm-chips" id={`mm-${level}-${tp.id}`}>
        {tp.concepts.map((q, i) => (
          <Chip key={q.slug} q={q} index={i} onHot={setHot} />
        ))}
      </div>
    );
    return (
      <div key={tp.id} className="mm-group" data-side={side}>
        {(side === 'left' || side === 'top') && chips}
        <button
          type="button"
          className="mm-topic"
          data-topic={tp.id}
          data-side={side}
          data-s={topicState(tp, status)}
          aria-expanded={isOpen}
          aria-controls={`mm-${level}-${tp.id}`}
          onClick={() => toggle(tp.id)}
          onMouseEnter={() => setHot(tp.id)}
          onMouseLeave={() => setHot(null)}
          onFocus={() => setHot(tp.id)}
          onBlur={() => setHot(null)}
        >
          <TopicSummary tp={tp} />
        </button>
        {(side === 'right' || side === 'bottom') && chips}
      </div>
    );
  };

  /* ---- small screens: the same content as a list, one topic open at a time ---- */
  const [mobileTopic, setMobileTopic] = useState<CategoryId | null>(null);

  return (
    <section className="rm-level" id={`map-${level}`} aria-label={label.level(level)}>
      <div className="mm" ref={mapRef} data-hot={hot ?? undefined}>
        <svg className="mm-edges" width={edges.w} height={edges.h} aria-hidden>
          {edges.list.map((e) => (
            <path
              key={e.key}
              d={e.d}
              data-kind={e.kind}
              data-s={e.s}
              data-hot={hot === e.topic || undefined}
              pathLength={e.kind === 'leaf' ? 1 : undefined}
            />
          ))}
        </svg>

        <div className="mm-side mm-left">{sides.left.map((tp) => group(tp, 'left'))}</div>

        <div className="mm-middle">
          {sides.top.map((tp) => group(tp, 'top'))}
          <div className="mm-hub" data-hub>
            <h3>{label.level(level)}</h3>
            <p>{label.blurb(level)}</p>
            <span className="rm-topic-meta">
              <Progress done={levelDone} total={levelStatuses.length} />
              <span>{t('roadmap.count', { done: levelDone, total: levelStatuses.length })}</span>
            </span>
          </div>
          {sides.bottom.map((tp) => group(tp, 'bottom'))}
        </div>

        <div className="mm-side mm-right">{sides.right.map((tp) => group(tp, 'right'))}</div>
      </div>

      <div className="rm-mobile">
        <div className="rm-mobile-head">
          <h3>{label.level(level)}</h3>
          <span>{t('roadmap.count', { done: levelDone, total: levelStatuses.length })}</span>
        </div>
        <p className="rm-mobile-level">{label.blurb(level)}</p>
        <Progress done={levelDone} total={levelStatuses.length} />
        {topics.map((tp) => (
          <div key={tp.id} className="rm-mobile-topic">
            <button
              type="button"
              className="rm-topic"
              data-s={topicState(tp, status)}
              aria-expanded={tp.id === mobileTopic}
              aria-controls={`rm-m-${level}-${tp.id}`}
              onClick={() => setMobileTopic((cur) => (cur === tp.id ? null : tp.id))}
            >
              <TopicSummary tp={tp} />
            </button>
            {tp.id === mobileTopic && (
              <ul className="rm-concepts rm-concepts-m" id={`rm-m-${level}-${tp.id}`}>
                {tp.concepts.map((q, i) => (
                  <QuestionCard key={q.slug} q={q} index={i} />
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ the map */

/** All levels one after the other, so the page scrolls from Junior to Senior. */
export function Roadmap() {
  const { t } = useTranslation();
  return (
    <div className="rm">
      <p className="rm-hint">{t('roadmap.hint')}</p>
      {LEVELS.map((l) => (
        <LevelMap key={l.id} level={l.id} />
      ))}
    </div>
  );
}
