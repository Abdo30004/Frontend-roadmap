import { useEffect, useRef, useState } from 'react';
import { Browser, Button, Code, Note, Row, Stack, Stat, Steps, usePlayer, type Tone } from '../../demo-kit';

export const scenario =
  'A Kanban board with 300 cards keeps card heights equal while a side drawer slides in when the board opens.';
export const task = 'Press "Open board" and watch the frame-time stats and the drawer while it runs for 2 seconds.';
export const solutionNote = 'Same board: all reads, then all writes (one layout per frame), and the drawer slides with transform.';

const CARD_COUNT = 300;
const RUN_MS = 2000;
const TITLES = ['Fix login', 'Refactor billing API and add retry logic', 'QA', 'Update docs for the v2 release notes', 'Design review', 'Ship it'];

/** The real code under test: equalize card heights, once per frame. Returns forced layouts. */
function equalize(cards: HTMLElement[], fixed: boolean, budgetEnd: number): number {
  if (fixed) {
    cards.forEach((n) => { n.style.height = 'auto'; });            // all writes
    const max = Math.max(...cards.map((n) => n.offsetHeight));     // one forced layout, then cached reads
    cards.forEach((n) => { n.style.height = `${max}px`; });        // all writes
    return 1;
  }
  let max = 0;
  let forced = 0;
  for (const n of cards) {
    n.style.height = 'auto';                    // WRITE (invalidates layout)
    max = Math.max(max, n.offsetHeight);        // READ  (forces layout now)
    n.style.height = `${max}px`;                // WRITE (invalidates again)
    forced++;
    if (performance.now() > budgetEnd) break;   // safety cap: never block > ~200ms
  }
  return forced;
}

interface Result { avg: number; worst: number; fps: number; forced: number }

function Board({ fixed }: { fixed: boolean }) {
  const boardRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const player = usePlayer(6, 260);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const run = () => {
    const board = boardRef.current;
    if (!board) return;
    const cards = Array.from(board.querySelectorAll<HTMLElement>('[data-card]'));
    setOpen(false);
    setResult(null);
    player.reset();
    setRunning(true);
    const frames: number[] = [];
    let forced = 0;
    const start = performance.now();
    let prev = start;
    // open the drawer on the next frame so its transition starts
    requestAnimationFrame(() => setOpen(true));
    const tick = (now: number) => {
      frames.push(now - prev);
      prev = now;
      forced = equalize(cards, fixed, performance.now() + 200);
      if (now - start < RUN_MS) {
        raf.current = requestAnimationFrame(tick);
      } else {
        const f = frames.slice(1);
        const avg = f.reduce((a, b) => a + b, 0) / Math.max(1, f.length);
        setResult({ avg, worst: Math.max(...f), fps: 1000 / avg, forced });
        setRunning(false);
        setTimeout(player.play, 0);
      }
    };
    raf.current = requestAnimationFrame(tick);
  };

  const tone = (bad: boolean): Tone => (result ? (bad ? 'bad' : 'good') : 'neutral');
  const steps: { label: string; detail: string; tone?: Tone }[] = fixed
    ? [
        { label: 'Render', detail: 'React diff' },
        { label: 'Commit', detail: 'DOM writes' },
        { label: 'Style', detail: '1× per frame' },
        { label: 'Layout', detail: '1× per frame (batched)', tone: 'good' },
        { label: 'Paint', detail: 'cards only; drawer skipped' },
        { label: 'Composite', detail: 'drawer moves here (transform)', tone: 'good' },
      ]
    : [
        { label: 'Render', detail: 'React diff' },
        { label: 'Commit', detail: 'DOM writes' },
        { label: 'Style', detail: `${CARD_COUNT}× per frame` },
        { label: 'Layout', detail: `${CARD_COUNT}× per frame (forced)`, tone: 'bad' },
        { label: 'Paint', detail: 'drawer repainted every frame (left)', tone: 'bad' },
        { label: 'Composite', detail: 'waits for the busy main thread', tone: 'warn' },
      ];

  return (
    <Stack gap={14}>
      <Browser url="tasks.example.com/boards/sprint-42">
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
          <div ref={boardRef} style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 190, overflow: 'auto', paddingRight: 4 }}>
            {Array.from({ length: CARD_COUNT }, (_, i) => (
              <div
                key={i}
                data-card
                style={{ width: 58, padding: 4, fontSize: 10, lineHeight: 1.2, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink-2)', overflow: 'hidden' }}
              >
                {TITLES[i % TITLES.length]}
              </div>
            ))}
          </div>
          <div
            aria-hidden={!open}
            style={{
              position: 'absolute', top: 0, bottom: 0, width: 150, padding: 10, fontSize: 12,
              background: 'var(--surface)', borderRight: '1px solid var(--line)', boxShadow: '4px 0 12px var(--line)',
              ...(fixed
                ? { left: 0, transform: open ? 'translateX(0)' : 'translateX(-110%)', transition: open ? `transform ${RUN_MS * 0.8}ms ease-out` : 'none' }
                : { left: open ? 0 : -165, transition: open ? `left ${RUN_MS * 0.8}ms ease-out` : 'none' }),
            }}
          >
            <strong>Sprint 42</strong>
            <Note>12 open · 3 blocked</Note>
          </div>
        </div>
      </Browser>

      <Row>
        <Button tone="primary" onClick={run} disabled={running}>{running ? 'Running 2s…' : 'Open board'}</Button>
      </Row>

      <Row gap={8}>
        <Stat label="FPS (avg)" value={result ? result.fps.toFixed(0) : '—'} tone={tone(!!result && result.fps < 50)} />
        <Stat label="avg frame (ms)" value={result ? result.avg.toFixed(1) : '—'} tone={tone(!!result && result.avg > 20)} />
        <Stat label="worst frame (ms)" value={result ? result.worst.toFixed(0) : '—'} tone={tone(!!result && result.worst > 50)} />
        <Stat label="forced layouts / frame" value={result ? result.forced : '—'} tone={tone(!!result && result.forced > 1)} />
      </Row>

      <Steps steps={steps} active={player.step} />

      <Code>{fixed
        ? `cards.forEach(n => n.style.height = 'auto');      // writes\nconst max = Math.max(...cards.map(n => n.offsetHeight)); // 1 layout\ncards.forEach(n => n.style.height = max + 'px');  // writes\n.drawer { transform: translateX(-100%); transition: transform }`
        : `cards.forEach(n => {\n  n.style.height = 'auto';                 // write\n  max = Math.max(max, n.offsetHeight);     // read → forced layout\n  n.style.height = max + 'px';             // write\n});\n.drawer { left: -165px; transition: left }`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <Board fixed={false} />;
}

export function Solution() {
  return <Board fixed />;
}
