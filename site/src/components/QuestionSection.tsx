import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { categoryLabel, questionId, type Question } from '../content';
import { useProgress } from '../progress';
import { questionSourceUrl } from '../site';
import { DemoBoundary } from './DemoBoundary';
import { demoLoader, type DemoModule } from './demos';
import { CheckIcon } from './Icons';

// The markdown renderer + syntax highlighter only load once someone reveals an answer.
const Markdown = lazy(() => import('./Markdown'));

/** `?reveal=all` opens every answer and loads every demo at once (used for smoke-testing). */
const REVEAL_ALL = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('reveal') === 'all';

/** Load a question's demo module only when its section comes near the viewport. */
function useDemo(level: string, slug: string, ref: React.RefObject<HTMLElement>) {
  const [mod, setMod] = useState<DemoModule | null | undefined>(undefined);
  useEffect(() => {
    const loader = demoLoader(level, slug);
    if (!loader) {
      setMod(null);
      return;
    }
    let cancelled = false;
    if (REVEAL_ALL) {
      loader().then((m) => !cancelled && setMod(m), () => !cancelled && setMod(null));
      return () => {
        cancelled = true;
      };
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          loader().then((m) => !cancelled && setMod(m), () => !cancelled && setMod(null));
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [level, slug, ref]);
  return mod;
}

function Stage({ kind, children, head, task }: { kind: 'problem' | 'solution'; children: ReactNode; head?: string; task?: string }) {
  return (
    <div className="stage" data-kind={kind}>
      <div className="stage-head">
        <span className="stage-tag">{kind === 'problem' ? 'The bug' : 'The fix'}</span>
        {head && <p className="scenario">{head}</p>}
      </div>
      {task && (
        <div className="stage-task">
          <span className="stage-task-label">Try it</span>
          <p>{task}</p>
        </div>
      )}
      <div className="stage-body">{children}</div>
    </div>
  );
}

export function QuestionSection({ q }: { q: Question }) {
  const ref = useRef<HTMLElement>(null);
  const mod = useDemo(q.level, q.slug, ref);
  const [open, setOpen] = useState(REVEAL_ALL);
  const { isDone, toggle } = useProgress();
  const id = questionId(q);
  const done = isDone(id);

  const loading = <p className="stage-missing">Loading the live demo…</p>;
  const missing = <p className="stage-missing">No live demo for this one yet — read the scenario in the answer.</p>;

  return (
    <section className="q" id={q.slug} ref={ref} aria-labelledby={`${q.slug}-t`}>
      <div className="q-meta">
        <span className="q-num">#{String(q.num).padStart(2, '0')}</span>
        <span className="q-cat">{categoryLabel(q.category)}</span>
        {done && <span className="q-done"><CheckIcon size={13} /> Understood</span>}
        <a className="q-src" href={questionSourceUrl(q.level, q.slug)} target="_blank" rel="noreferrer">
          View on GitHub
        </a>
      </div>
      <h2 id={`${q.slug}-t`}>
        <a href={`#${q.slug}`}>{q.title}</a>
      </h2>
      {q.merged.length > 1 && (
        <details className="merged">
          <summary>Also asked as ({q.merged.length} phrasings)</summary>
          <ul>
            {q.merged.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </details>
      )}

      <Stage kind="problem" head={mod?.scenario} task={mod?.task}>
        {mod === undefined ? loading : mod === null ? missing : (
          <DemoBoundary>
            <mod.Problem />
          </DemoBoundary>
        )}
      </Stage>

      <div className="think">
        <p>
          <strong>Before you look:</strong> what is causing this, and how would you fix it? Say it out loud — that is the interview.
        </p>
        <button className="reveal-btn" aria-expanded={open} aria-controls={`${q.slug}-answer`} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide the answer' : 'Reveal the answer'}
          <span aria-hidden>{open ? '↑' : '↓'}</span>
        </button>
      </div>

      {open && (
        <div className="answer" id={`${q.slug}-answer`} data-open>
          {mod && (
            <Stage kind="solution" head={mod.solutionNote}>
              <DemoBoundary>
                <mod.Solution />
              </DemoBoundary>
            </Stage>
          )}

          <Suspense fallback={<p className="stage-missing">Loading the explanation…</p>}>
          <h3>The concept</h3>
          <Markdown>{q.concept}</Markdown>

          <h3>The real-life case</h3>
          <Markdown>{q.problem}</Markdown>

          <h3>How to fix it</h3>
          <Markdown>{q.fix}</Markdown>

          <h3>Say it in the interview</h3>
          <Markdown>{q.interview}</Markdown>
          </Suspense>

          <div className="understood">
            <span>Could you explain this to an interviewer without looking?</span>
            <button aria-pressed={done} onClick={() => toggle(id)}>
              {done ? <><CheckIcon size={15} /> Understood</> : 'Mark as understood'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
