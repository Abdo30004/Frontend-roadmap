import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Badge, Browser, Button, Code, Console, Input, Note, Panel, Row, Stack, Stat, fakeRequest, useConsole } from '../../demo-kit';

export const scenario =
  'A crypto trading dashboard has a symbol search that shows results as you type, and a price chart with a hover crosshair.';
export const task =
  'Type "eth" quickly in the search, then wait. Compare the request counter and which query the results are for. Then move over the chart.';
export const solutionNote =
  'Same UI: the search is debounced (300ms) with AbortController, and the crosshair is throttled to one update per 100ms.';

const SYMBOLS = [
  'BTC-USD',
  'BTC-EUR',
  'BCH-USD',
  'ETH-USD',
  'ETH-BTC',
  'ETC-USD',
  'SOL-USD',
  'SOL-ETH',
  'DOGE-USD',
  'DOT-USD',
  'ADA-USD',
  'AVAX-USD',
  'LINK-ETH',
  'LTC-USD',
  'XRP-USD',
  'TETHER-USD',
  'METIS-USD',
  'BETH-ETH',
];

// Short queries match more symbols, so the server is slower for them (plus some jitter).
const latency = (q: string) => Math.max(150, 1100 - q.length * 260) + Math.random() * 250;

function throttle<A extends unknown[]>(fn: (...args: A) => void, wait: number) {
  let last = 0;
  let t: ReturnType<typeof setTimeout> | undefined;
  const run = (...args: A) => {
    const remaining = wait - (Date.now() - last);
    clearTimeout(t);
    if (remaining <= 0) {
      last = Date.now();
      fn(...args);
    } else
      t = setTimeout(() => {
        last = Date.now();
        fn(...args);
      }, remaining); // trailing call
  };
  run.cancel = () => clearTimeout(t);
  return run;
}

function SymbolSearch({ fixed }: { fixed: boolean }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [shown, setShown] = useState<{ q: string; items: string[] } | null>(null);
  const [sent, setSent] = useState(0);
  const [late, setLate] = useState(0);
  const seq = useRef(0);
  const applied = useRef(0);
  const unmount = useRef(new AbortController());
  const c = useConsole();
  useEffect(() => () => unmount.current.abort(), []);

  const search = (q: string, signal: AbortSignal) => {
    const id = ++seq.current;
    setSent((n) => n + 1);
    c.log(`→ #${id} GET /api/symbols?q=${q}`, 'info');
    fakeRequest(() => SYMBOLS.filter((s) => s.toLowerCase().includes(q)), { delay: latency(q), signal })
      .then((items) => {
        if (id < applied.current) {
          setLate((n) => n + 1);
          c.log(`← #${id} "${q}" arrived late and replaced newer results`, 'bad');
        } else c.log(`← #${id} "${q}" → ${items.length} results`, 'good');
        applied.current = Math.max(applied.current, id);
        setShown({ q, items });
      })
      .catch(() => {
        if (!unmount.current.signal.aborted) c.log(`✕ #${id} "${q}" aborted`, 'warn');
      });
  };

  // Fixed version: wait for a 300ms pause in typing...
  useEffect(() => {
    if (!fixed) return;
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [fixed, query]);
  // ...then send one request, and cancel it if a newer one starts.
  useEffect(() => {
    if (!fixed || !debounced) return;
    const ctrl = new AbortController();
    search(debounced, ctrl.signal);
    return () => ctrl.abort();
  }, [fixed, debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (value: string) => {
    setQuery(value);
    const q = value.trim().toLowerCase();
    if (!fixed && q) search(q, unmount.current.signal); // one request per keystroke
  };

  const reset = () => {
    setQuery('');
    setDebounced('');
    setShown(null);
    setSent(0);
    setLate(0);
    c.clear();
  };
  const mismatch = shown !== null && shown.q !== query.trim().toLowerCase();

  return (
    <Stack gap={12}>
      <Browser url="trade.example/markets">
        <Stack gap={10}>
          <Row gap={8}>
            <Input
              value={query}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Search symbol (try: eth)"
              aria-label="Search symbol"
              style={{ flex: '1 1 160px' }}
            />
            <Button tone="ghost" onClick={reset}>
              Reset
            </Button>
          </Row>
          {shown && (
            <Badge tone={mismatch ? 'bad' : 'good'}>
              Results for "{shown.q}"{mismatch ? ` while the box says "${query}"` : ''}
            </Badge>
          )}
          <Row gap={6}>{shown ? shown.items.map((s) => <Badge key={s}>{s}</Badge>) : <Note>Start typing to search.</Note>}</Row>
        </Stack>
      </Browser>
      <Row gap={8}>
        <Stat label="requests sent" value={sent} tone={sent > 2 ? 'bad' : 'neutral'} />
        <Stat label="late responses applied" value={late} tone={late > 0 ? 'bad' : 'good'} />
      </Row>
      <Code>
        {fixed
          ? `useEffect(() => { const t = setTimeout(() => setDebounced(query), 300);\n  return () => clearTimeout(t); }, [query]);\nuseEffect(() => { const ctrl = new AbortController();\n  search(debounced, ctrl.signal); return () => ctrl.abort(); }, [debounced]);`
          : `<input onChange={(e) => {\n  setQuery(e.target.value);\n  search(e.target.value).then(setResults); // 1 request per key\n}} />`}
      </Code>
      <Console lines={c.lines} height={120} onClear={c.clear} />
    </Stack>
  );
}

function PriceChart({ fixed }: { fixed: boolean }) {
  const [x, setX] = useState(0);
  const [updates, setUpdates] = useState(0);
  const events = useRef(0);
  const eventsEl = useRef<HTMLSpanElement>(null);
  const apply = (nx: number) => {
    setX(nx);
    setUpdates((u) => u + 1);
  }; // a state update = a re-render
  const throttled = useMemo(() => throttle(apply, 100), []); // created once, not on every render
  useEffect(() => () => throttled.cancel(), [throttled]);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    events.current++;
    if (eventsEl.current) eventsEl.current.textContent = String(events.current); // no re-render for the counter
    const nx = e.clientX - e.currentTarget.getBoundingClientRect().left;
    if (fixed) throttled(nx);
    else apply(nx);
  };

  return (
    <Panel title="BTC-USD · hover the chart">
      <Stack gap={10}>
        <div
          onPointerMove={onMove}
          style={{
            position: 'relative',
            height: 90,
            borderRadius: 8,
            background: 'var(--paper-2)',
            overflow: 'hidden',
            touchAction: 'none',
          }}
        >
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <polyline
              points="0,30 10,26 20,28 30,18 40,22 50,12 60,16 70,8 80,14 90,6 100,10"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: 1,
              background: 'var(--ink-3)',
              transform: `translateX(${x}px)`,
            }}
          />
        </div>
        <Row gap={8}>
          <Stat label="pointermove events" value={<span ref={eventsEl}>0</span>} />
          <Stat label="state updates (renders)" value={updates} tone={updates > 60 && !fixed ? 'bad' : 'neutral'} />
        </Row>
      </Stack>
    </Panel>
  );
}

function Dashboard({ fixed }: { fixed: boolean }) {
  return (
    <Stack gap={14}>
      <SymbolSearch fixed={fixed} />
      <PriceChart fixed={fixed} />
    </Stack>
  );
}

export function Problem() {
  return <Dashboard fixed={false} />;
}

export function Solution() {
  return <Dashboard fixed />;
}
