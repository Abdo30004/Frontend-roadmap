import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Badge, Browser, Button, Code, Meter, Note, Panel, Row, Stack, Stat, type Tone } from '../../demo-kit';

export const scenario =
  'A second-hand marketplace search page scores 98 in Lighthouse on a laptop, but Android users say tapping "Filters" does nothing for a while.';
export const task = 'At 1x, press "Load page" then "Filters". Switch to 6x (mid-range Android) and do it again. Compare lab vs field INP.';
export const solutionNote =
  'Same page and same work, split into ~50-item chunks that yield to the main thread; the chat widget waits for idle.';

type Cpu = 1 | 4 | 6;
const LISTINGS = ['Road bike, 54cm', 'Vintage camera', 'Oak desk', 'Kids scooter', 'Espresso machine', 'Hiking boots 43'];
// CPU cost at 1x; multiplied by the throttle. 6x max = 240ms (bounded).
const HYDRATE_MS = 30;
const CHAT_MS = 10;
const FILTER_MS = 35;
const CHUNKS = 8;

function burn(ms: number) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    /* enrich listings: relevance score, price + date formatting */
  }
}
const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));
const afterPaint = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function SearchPage({ fixed }: { fixed: boolean }) {
  const [cpu, setCpu] = useState<Cpu>(1);
  const [loaded, setLoaded] = useState(false);
  const [chat, setChat] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtered, setFiltered] = useState(false);
  const [tasks, setTasks] = useState<number[]>([]);
  const [inp, setInp] = useState<number | null>(null);
  const [field, setField] = useState<Partial<Record<Cpu, number>>>({});
  const alive = useRef(true);
  const timers = useRef<number[]>([]);
  useEffect(
    () => () => {
      alive.current = false;
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  /** Runs `ms` of work as one task (bug) or as CHUNKS short tasks with yields (fix). */
  const work = async (ms: number) => {
    const scaled = ms * cpu;
    if (!fixed) {
      const t = performance.now();
      burn(scaled);
      setTasks((x) => [...x, performance.now() - t].slice(-12));
      return;
    }
    for (let i = 0; i < CHUNKS && alive.current; i++) {
      const t = performance.now();
      burn(scaled / CHUNKS);
      const d = performance.now() - t;
      setTasks((x) => [...x, d].slice(-12));
      await yieldToMain();
    }
  };

  const load = async () => {
    setLoaded(false);
    setChat(false);
    setFiltersOpen(false);
    setFiltered(false);
    setTasks([]);
    setInp(null);
    await afterPaint();
    if (fixed) {
      await work(HYDRATE_MS);
      if (alive.current) setLoaded(true);
      // non-critical third party: loaded after the page is interactive
      timers.current.push(
        window.setTimeout(() => {
          if (alive.current) {
            burn(CHAT_MS * cpu);
            setChat(true);
          }
        }, 800),
      );
    } else {
      const t = performance.now();
      burn(CHAT_MS * cpu); // chat SDK initialised synchronously
      burn(HYDRATE_MS * cpu); // hydrate + enrich 500 cards in one go
      setTasks([performance.now() - t]);
      setChat(true);
      setLoaded(true);
    }
  };

  const openFilters = async (e: MouseEvent) => {
    const start = e.timeStamp; // when the tap happened
    const measure = () =>
      requestAnimationFrame(() =>
        setTimeout(() => {
          if (!alive.current) return;
          const ms = performance.now() - start;
          setInp(ms);
          setField((f) => ({ ...f, [cpu]: Math.max(f[cpu] ?? 0, ms) }));
        }, 0),
      );
    if (fixed) {
      setFiltersOpen(true);
      setFiltered(false); // respond to the tap first
      measure();
      await afterPaint();
      await work(FILTER_MS); // then the heavy part, in chunks
      if (alive.current) setFiltered(true);
    } else {
      await work(FILTER_MS); // heavy work before anything is shown
      setFiltersOpen(true);
      setFiltered(true);
      measure();
    }
  };

  const tone = (ms: number | undefined): Tone => (ms === undefined ? 'neutral' : ms <= 200 ? 'good' : 'bad');
  const longTasks = tasks.filter((t) => t > 50).length;

  return (
    <Stack gap={12}>
      <Row gap={6}>
        <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>CPU throttle:</span>
        {([1, 4, 6] as Cpu[]).map((c) => (
          <Button key={c} tone={cpu === c ? 'primary' : 'default'} onClick={() => setCpu(c)}>
            {c}x{c === 1 ? ' laptop' : c === 6 ? ' mid Android' : ''}
          </Button>
        ))}
      </Row>

      <Browser url="resell.example.com/search?q=bike">
        <Stack gap={8}>
          <Row gap={6}>
            <Button tone="primary" onClick={load}>
              Load page
            </Button>
            <Button onClick={openFilters} disabled={!loaded}>
              Filters
            </Button>
            {chat && <Badge tone="info">chat widget</Badge>}
          </Row>
          {filtersOpen && (
            <Panel title="Filters">
              <Row gap={6}>
                <Badge>Price ≤ €200</Badge>
                <Badge>Within 10 km</Badge>
                <Badge tone={filtered ? 'good' : 'info'}>{filtered ? '312 results' : 'updating…'}</Badge>
              </Row>
            </Panel>
          )}
          {loaded ? (
            <Row gap={6}>
              {LISTINGS.map((l) => (
                <Badge key={l}>{l}</Badge>
              ))}
              <Note>+494 more</Note>
            </Row>
          ) : (
            <Note>Press "Load page" to hydrate 500 listing cards.</Note>
          )}
        </Stack>
      </Browser>

      <Row gap={8}>
        <Stat label="INP (this tap)" value={inp === null ? '—' : `${Math.round(inp)} ms`} tone={tone(inp ?? undefined)} />
        <Stat label="long tasks (>50ms)" value={longTasks} tone={tasks.length ? (longTasks ? 'bad' : 'good') : 'neutral'} />
        <Stat label="Lab · laptop 1x" value={field[1] === undefined ? '—' : `${Math.round(field[1])} ms`} tone={tone(field[1])} />
        <Stat label="Field · Android 6x" value={field[6] === undefined ? '—' : `${Math.round(field[6])} ms`} tone={tone(field[6])} />
      </Row>

      <Panel title="Main-thread tasks (last 12)">
        {tasks.length === 0 ? (
          <Note>No tasks recorded yet.</Note>
        ) : (
          <Stack gap={4}>
            {tasks.map((t, i) => (
              <Row key={i} gap={8} wrap={false}>
                <code style={{ fontSize: 11, width: 52, flex: 'none' }}>{Math.round(t)} ms</code>
                <div style={{ flex: 1 }}>
                  <Meter value={t} max={250} tone={t > 50 ? 'bad' : 'good'} />
                </div>
              </Row>
            ))}
          </Stack>
        )}
      </Panel>

      <Code>
        {fixed
          ? `setFiltersOpen(true);            // paint the response first\nawait afterPaint();\nfor (const chunk of chunks(items, 50)) {\n  enrich(chunk);\n  await scheduler.yield?.() ?? new Promise(r => setTimeout(r));\n}`
          : `onClick={() => {\n  const enriched = items.map(enrich).sort(byScore); // one long task\n  setFiltersOpen(true);\n}}`}
      </Code>
    </Stack>
  );
}

export function Problem() {
  return <SearchPage fixed={false} />;
}

export function Solution() {
  return <SearchPage fixed />;
}
