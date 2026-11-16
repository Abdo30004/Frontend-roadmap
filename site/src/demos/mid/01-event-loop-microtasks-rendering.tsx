import { useEffect, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Note, Panel, Row, Stack, Stat, Steps, usePlayer } from '../../demo-kit';

export const scenario = 'A logistics dashboard imports a shipments CSV in chunks and shows a progress bar so the user can follow the import.';
export const task = 'Click "Import shipments.csv" and watch the progress bar, the "screen updates" counter and the longest freeze.';
export const solutionNote = 'Same chunked import, but each chunk yields a real task (setTimeout), so the browser paints between chunks.';

const ROWS = 20_000;
const CHUNKS = 24;
const CHUNK_MS = 9; // ~216ms of CPU work in total: bounded, never freezes the page for long

/** Stand-in for validateAndNormalize() on 500+ rows: real, blocking CPU work. */
function busy(ms: number) {
  const end = performance.now() + ms;
  while (performance.now() < end) { /* crunching rows */ }
}
const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

interface Result { frames: number; freeze: number; total: number }

function Importer({ fixed }: { fixed: boolean }) {
  const fillRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const rafRef = useRef(0);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const onProgress = (pct: number) => {
    // Direct DOM writes, like the real code: the DOM changes, but only a paint makes it visible.
    if (fillRef.current) fillRef.current.style.transform = `scaleX(${pct / 100})`;
    if (pctRef.current) pctRef.current.textContent = `${pct}%`;
  };

  const importRows = async () => {
    onProgress(0);
    setResult(null);
    setRunning(true);
    const start = performance.now();
    let frames = 0;
    let last = start;
    let freeze = 0;
    let active = true;
    const tick = (now: number) => {
      if (!active) return;
      frames++;
      freeze = Math.max(freeze, now - last);
      last = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    for (let i = 0; i < CHUNKS; i++) {
      busy(CHUNK_MS);
      onProgress(Math.round(((i + 1) / CHUNKS) * 100));
      if (fixed) await yieldToMain(); // ends the task: render + input can run
      else await Promise.resolve();   // only a microtask: the browser never gets to paint
    }

    const end = performance.now();
    active = false;
    cancelAnimationFrame(rafRef.current);
    freeze = Math.max(freeze, end - last);
    setResult({ frames, freeze: Math.round(freeze), total: Math.round(end - start) });
    setRunning(false);
  };

  return (
    <Stack gap={14}>
      <Browser url="fleet.example/shipments/import">
        <Stack gap={10}>
          <Row gap={8}>
            <strong>shipments.csv</strong>
            <Badge>{ROWS.toLocaleString()} rows</Badge>
            {result && <Badge tone="good">Imported</Badge>}
          </Row>
          <div style={{ position: 'relative', height: 14, borderRadius: 99, background: 'var(--paper-2)', overflow: 'hidden' }}>
            <div ref={fillRef} style={{ position: 'absolute', inset: 0, background: 'var(--accent)', transformOrigin: 'left', transform: 'scaleX(0)' }} />
          </div>
          <Row gap={8}>
            <Button tone="primary" onClick={importRows} disabled={running}>Import shipments.csv</Button>
            <span ref={pctRef} style={{ font: '600 14px var(--font-mono)', color: 'var(--ink-2)' }}>0%</span>
          </Row>
        </Stack>
      </Browser>
      <Row gap={8}>
        <Stat label="screen updates during import" value={result ? result.frames : '–'} tone={result ? (result.frames < 3 ? 'bad' : 'good') : 'neutral'} />
        <Stat label="longest freeze (ms)" value={result ? result.freeze : '–'} tone={result ? (result.freeze > 50 ? 'bad' : 'good') : 'neutral'} />
        <Stat label="total time (ms)" value={result ? result.total : '–'} />
      </Row>
      <Code>{fixed
        ? `busy(chunk);            // validate 500 rows\nonProgress(pct);\nawait new Promise((r) => setTimeout(r, 0)); // a new TASK`
        : `busy(chunk);            // validate 500 rows\nonProgress(pct);\nawait Promise.resolve(); // "yield"?`}</Code>
      <EventLoopModel />
    </Stack>
  );
}

/* ---------- animated model of the event loop ---------- */

interface Frame { phase: number; label: string; stack: string[]; micro: string[]; tasks: string[]; out: string[] }

const FRAMES: Frame[] = [
  { phase: 0, label: 'The script itself is a task', stack: ['script'], micro: [], tasks: [], out: [] },
  { phase: 0, label: 'log(1) runs right away', stack: ['script', 'log(1)'], micro: [], tasks: [], out: ['1'] },
  { phase: 0, label: 'setTimeout puts a callback in the TASK queue', stack: ['script', 'setTimeout'], micro: [], tasks: ['log(2)'], out: ['1'] },
  { phase: 0, label: 'Promise is resolved: .then goes to the MICROTASK queue', stack: ['script', '.then'], micro: ['log(3)'], tasks: ['log(2)'], out: ['1'] },
  { phase: 0, label: 'log(5) runs, the script ends', stack: ['script', 'log(5)'], micro: ['log(3)'], tasks: ['log(2)'], out: ['1', '5'] },
  { phase: 1, label: 'Stack is empty: drain ALL microtasks', stack: ['log(3)'], micro: [], tasks: ['log(2)'], out: ['1', '5', '3'] },
  { phase: 1, label: 'Running 3 queued the chained .then: it runs too', stack: ['log(4)'], micro: [], tasks: ['log(2)'], out: ['1', '5', '3', '4'] },
  { phase: 2, label: 'Microtasks empty: the browser may paint now', stack: [], micro: [], tasks: ['log(2)'], out: ['1', '5', '3', '4'] },
  { phase: 3, label: 'Next task: the timeout callback', stack: ['log(2)'], micro: [], tasks: [], out: ['1', '5', '3', '4', '2'] },
];

const PHASES = [
  { label: 'Run one task', detail: 'until the stack is empty' },
  { label: 'Drain microtasks', detail: 'Promises, await, queueMicrotask', tone: 'info' as const },
  { label: 'Render', detail: 'rAF, style, layout, paint', tone: 'good' as const },
  { label: 'Next task', detail: 'setTimeout, events…' },
];

function Lane({ title, items, tone }: { title: string; items: string[]; tone: 'info' | 'warn' | 'neutral' }) {
  return (
    <Panel title={title} style={{ flex: '1 1 90px', minHeight: 70 }}>
      <Stack gap={4}>
        {items.length === 0 ? <Note>empty</Note> : items.map((s, i) => <Badge key={s + i} tone={tone}>{s}</Badge>)}
      </Stack>
    </Panel>
  );
}

function EventLoopModel() {
  const p = usePlayer(FRAMES.length, 1100);
  const f = p.step >= 0 ? FRAMES[p.step] : null;
  return (
    <Panel title="How the event loop orders this">
      <Stack gap={10}>
        <Code>{`console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve()
  .then(() => console.log('3'))
  .then(() => console.log('4'));
console.log('5');`}</Code>
        <Row>
          <Button onClick={p.play} disabled={p.playing}>{p.step < 0 ? 'Play' : 'Replay'}</Button>
          <Button tone="ghost" onClick={p.next} disabled={p.playing || p.done}>Step</Button>
        </Row>
        <Steps steps={PHASES} active={f ? f.phase : -1} />
        <Note>{f ? f.label : 'Press Play to step through the loop.'}</Note>
        <Row gap={8} align="stretch">
          <Lane title="Call stack" items={f ? [...f.stack].reverse() : []} tone="neutral" />
          <Lane title="Microtasks" items={f ? f.micro : []} tone="info" />
          <Lane title="Tasks" items={f ? f.tasks : []} tone="warn" />
        </Row>
        <Row gap={6}>
          <strong style={{ fontSize: 13 }}>Output:</strong>
          {(f ? f.out : []).map((o) => <Badge key={o} tone="good">{o}</Badge>)}
        </Row>
      </Stack>
    </Panel>
  );
}

export function Problem() {
  return <Importer fixed={false} />;
}

export function Solution() {
  return <Importer fixed />;
}
