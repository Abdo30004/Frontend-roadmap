import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { questionId, useLabels, type Question } from '../content';
import { useLang } from '../i18n';
import { useProgress } from '../progress';
import { questionSourceUrl } from '../site';
import { DemoBoundary } from './DemoBoundary';
import { demoLoader, type DemoModule } from './demos';
import { CheckIcon } from './Icons';

// French scenario / task / fix-note text for the demos (the demo apps themselves stay in English).
// Loaded through a glob so a missing file never breaks the build.
type DemoText = { scenario: string; task?: string; solutionNote?: string };
const FR_MODULE = import.meta.glob<{ DEMO_FR: Record<string, DemoText> }>('../demos/fr.ts', { eager: true });
const DEMO_FR: Record<string, DemoText> = Object.values(FR_MODULE)[0]?.DEMO_FR ?? {};

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
  const { t } = useTranslation();
  return (
    <div className="stage" data-kind={kind}>
      <div className="stage-head">
        <span className="stage-tag">{kind === 'problem' ? t('question.bug') : t('question.fix')}</span>
        {head && <p className="scenario">{head}</p>}
      </div>
      {task && (
        <div className="stage-task">
          <span className="stage-task-label">{t('question.tryIt')}</span>
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
  const { t } = useTranslation();
  const label = useLabels();
  const lang = useLang();
  const id = questionId(q);
  const done = isDone(id);
  const text = lang === 'fr' && mod ? { ...mod, ...DEMO_FR[id] } : mod;

  const loading = <p className="stage-missing">{t('question.loadingDemo')}</p>;
  const missing = <p className="stage-missing">{t('question.noDemo')}</p>;

  return (
    <section className="q" id={q.slug} ref={ref} aria-labelledby={`${q.slug}-t`}>
      <div className="q-meta">
        <span className="q-num">#{String(q.num).padStart(2, '0')}</span>
        <span className="q-cat">{label.category(q.category)}</span>
        {done && <span className="q-done"><CheckIcon size={13} /> {t('common.understood')}</span>}
        <a className="q-src" href={questionSourceUrl(q.level, q.slug)} target="_blank" rel="noreferrer">
          {t('question.viewOnGithub')}
        </a>
      </div>
      <h2 id={`${q.slug}-t`}>
        <a href={`#${q.slug}`}>{q.title}</a>
      </h2>
      {q.merged.length > 1 && (
        <details className="merged">
          <summary>{t('question.alsoAsked', { count: q.merged.length })}</summary>
          <ul>
            {q.merged.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </details>
      )}

      <Stage kind="problem" head={text?.scenario} task={text?.task}>
        {mod === undefined ? loading : mod === null ? missing : (
          <DemoBoundary>
            <mod.Problem />
          </DemoBoundary>
        )}
      </Stage>

      <div className="think">
        <p>
          <strong>{t('question.beforeYouLook')}</strong> {t('question.beforeYouLookText')}
        </p>
        <button className="reveal-btn" aria-expanded={open} aria-controls={`${q.slug}-answer`} onClick={() => setOpen((o) => !o)}>
          {open ? t('question.hide') : t('question.reveal')}
          <span aria-hidden>{open ? '↑' : '↓'}</span>
        </button>
      </div>

      {open && (
        <div className="answer" id={`${q.slug}-answer`} data-open>
          {mod && (
            <Stage kind="solution" head={text?.solutionNote}>
              <DemoBoundary>
                <mod.Solution />
              </DemoBoundary>
            </Stage>
          )}

          <Suspense fallback={<p className="stage-missing">{t('question.loadingExplanation')}</p>}>
          {!q.translated && <p className="untranslated">{t('question.notTranslated')}</p>}
          <h3>{t('question.concept')}</h3>
          <Markdown>{q.concept}</Markdown>

          <h3>{t('question.realCase')}</h3>
          <Markdown>{q.problem}</Markdown>

          <h3>{t('question.howToFix')}</h3>
          <Markdown>{q.fix}</Markdown>

          <h3>{t('question.sayIt')}</h3>
          <Markdown>{q.interview}</Markdown>
          </Suspense>

          <div className="understood">
            <span>{t('question.couldYou')}</span>
            <button aria-pressed={done} onClick={() => toggle(id)}>
              {done ? <><CheckIcon size={15} /> {t('common.understood')}</> : t('question.markUnderstood')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
