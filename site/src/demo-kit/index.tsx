/**
 * Demo kit — shared building blocks for the live "problem" / "solution" demos.
 * Every demo should be built from these so the whole course looks consistent.
 * Colors: only use CSS variables (var(--ink), var(--bad), ...) so dark mode works.
 */
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import './kit.css';

export type Tone = 'neutral' | 'bad' | 'good' | 'warn' | 'info';

/* ---------- layout ---------- */

export function Row({ children, gap = 8, wrap = true, align = 'center', style }: {
  children: ReactNode; gap?: number; wrap?: boolean; align?: CSSProperties['alignItems']; style?: CSSProperties;
}) {
  return <div style={{ display: 'flex', gap, flexWrap: wrap ? 'wrap' : 'nowrap', alignItems: align, ...style }}>{children}</div>;
}

export function Stack({ children, gap = 10, style }: { children: ReactNode; gap?: number; style?: CSSProperties }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>{children}</div>;
}

/** A bordered surface, optionally titled. Use for "app" areas inside a demo. */
export function Panel({ title, children, tone, style }: { title?: ReactNode; children: ReactNode; tone?: Tone; style?: CSSProperties }) {
  return (
    <div className="dk-panel" data-tone={tone} style={style}>
      {title && <div className="dk-panel-title">{title}</div>}
      {children}
    </div>
  );
}

/** Fake browser window, so a demo reads like a real product page. */
export function Browser({ url = 'app.example.com', children, style }: { url?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="dk-browser" style={style}>
      <div className="dk-browser-bar">
        <span className="dk-dots"><i /><i /><i /></span>
        <span className="dk-url">{url}</span>
      </div>
      <div className="dk-browser-body">{children}</div>
    </div>
  );
}

/* ---------- controls ---------- */

export function Button({ tone = 'default', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'default' | 'primary' | 'danger' | 'ghost';
}) {
  return <button type="button" {...props} className={`dk-btn ${className}`} data-tone={tone} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`dk-input ${props.className ?? ''}`} />;
}

export function Label({ children, text }: { children: ReactNode; text: string }) {
  return (
    <label className="dk-label">
      <span>{text}</span>
      {children}
    </label>
  );
}

/* ---------- display ---------- */

export function Stat({ label, value, tone = 'neutral' }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className="dk-stat" data-tone={tone}>
      <span className="dk-stat-value">{value}</span>
      <span className="dk-stat-label">{label}</span>
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className="dk-badge" data-tone={tone}>{children}</span>;
}

/** Small muted caption explaining what to look at. Never put the answer here in a Problem demo. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="dk-note">{children}</p>;
}

/** Splits a line into code and a trailing `// comment` (ignores the `//` in URLs like `https://`). */
function withComment(line: string, i: number): ReactNode {
  const m = /(^|\s)(\/\/.*)$/.exec(line);
  if (!m) return <Fragment key={i}>{line}{'\n'}</Fragment>;
  const at = m.index + m[1].length;
  return (
    <Fragment key={i}>
      {line.slice(0, at)}<span className="dk-code-comment">{m[2]}</span>{'\n'}
    </Fragment>
  );
}

/** Code block for a few lines shown inside a demo, in a dark editor frame. `title` is the label in its top bar. */
export function Code({ children, title = 'Code' }: { children: string; title?: string }) {
  const lines = children.replace(/^\n/, '').replace(/\n\s*$/, '').split('\n');
  return (
    <figure className="dk-codeblock">
      <figcaption className="dk-code-bar">{title}</figcaption>
      <pre className="dk-code"><code>{lines.map(withComment)}</code></pre>
    </figure>
  );
}

/** Horizontal meter. value/max in [0..max]. Animated with transform only. */
export function Meter({ value, max = 100, tone = 'info', label }: { value: number; max?: number; tone?: Tone; label?: string }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div className="dk-meter" data-tone={tone} role="meter" aria-valuenow={value} aria-valuemax={max} aria-label={label}>
      <div className="dk-meter-fill" style={{ transform: `scaleX(${pct})` }} />
      {label && <span className="dk-meter-label">{label}</span>}
    </div>
  );
}

/* ---------- console ---------- */

export interface ConsoleLine { id: number; text: string; tone: Tone }

/** A tiny console. `const c = useConsole(); c.log('hi', 'bad'); <Console lines={c.lines} />` */
export function useConsole(max = 60) {
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const id = useRef(0);
  const log = useCallback((text: unknown, tone: Tone = 'neutral') => {
    const str = typeof text === 'string' ? text : JSON.stringify(text);
    setLines((prev) => [...prev, { id: id.current++, text: str, tone }].slice(-max));
  }, [max]);
  const clear = useCallback(() => setLines([]), []);
  return { lines, log, clear };
}

export function Console({ lines, height = 160, title = 'Console', onClear }: {
  lines: ConsoleLine[]; height?: number; title?: string; onClear?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);
  return (
    <div className="dk-console">
      <div className="dk-console-bar">
        <span>{title}</span>
        {onClear && <button type="button" onClick={onClear}>clear</button>}
      </div>
      <div className="dk-console-body" ref={ref} style={{ height }} aria-live="polite">
        {lines.length === 0 && <div className="dk-console-empty">Nothing logged yet. Use the demo above.</div>}
        {lines.map((l) => (
          <div key={l.id} className="dk-console-line" data-tone={l.tone}>{l.text}</div>
        ))}
      </div>
    </div>
  );
}

/* ---------- step-by-step simulations ---------- */

/** Highlights the active step of a process. Use with usePlayer for animated walk-throughs. */
export function Steps({ steps, active, vertical = false }: {
  steps: { label: string; detail?: string; tone?: Tone }[]; active: number; vertical?: boolean;
}) {
  return (
    <ol className="dk-steps" data-vertical={vertical || undefined}>
      {steps.map((s, i) => (
        <li key={i} data-state={i < active ? 'done' : i === active ? 'active' : 'todo'} data-tone={s.tone}>
          <span className="dk-step-dot">{i + 1}</span>
          <span className="dk-step-text">
            <strong>{s.label}</strong>
            {s.detail && <small>{s.detail}</small>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Drives a step-by-step animation. step = -1 before start. */
export function usePlayer(count: number, interval = 900) {
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    if (step >= count - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), step < 0 ? 50 : interval);
    return () => clearTimeout(t);
  }, [playing, step, count, interval]);
  return {
    step,
    playing,
    done: step >= count - 1,
    play: () => { setStep(-1); setPlaying(true); },
    next: () => setStep((s) => Math.min(count - 1, s + 1)),
    reset: () => { setPlaying(false); setStep(-1); },
  };
}

/* ---------- async helpers ---------- */

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

/** Simulated network request. Abortable, can fail, random-ish latency if delay is [min,max]. */
export async function fakeRequest<T>(value: T | (() => T), opts: {
  delay?: number | [number, number]; fail?: boolean | string; signal?: AbortSignal;
} = {}): Promise<T> {
  const { delay = 600, fail = false, signal } = opts;
  const ms = Array.isArray(delay) ? delay[0] + Math.random() * (delay[1] - delay[0]) : delay;
  await sleep(ms, signal);
  if (fail) throw new Error(typeof fail === 'string' ? fail : 'Request failed (500)');
  return typeof value === 'function' ? (value as () => T)() : value;
}

/** Re-mount children with a fresh state — handy "Reset demo" button. */
export function Resettable({ children }: { children: (reset: () => void) => ReactNode }) {
  const [key, setKey] = useState(0);
  return <div key={key}>{children(() => setKey((k) => k + 1))}</div>;
}
