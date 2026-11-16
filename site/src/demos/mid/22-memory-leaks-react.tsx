import { useEffect, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Note, Row, Stack, Stat, useConsole } from '../../demo-kit';

export const scenario = 'A trading dashboard stays open all day. Traders open the price chart panel and switch instruments many times per hour.';
export const task = 'Open the chart, switch instruments a few times, then close it. Watch the stats and the console.';
export const solutionNote = 'Same chart: the effect returns a cleanup that removes the listeners and clears the interval.';

const SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'MSFT'];
const POINTS = 100_000; // 8 bytes each ≈ 0.8 MB of price history per chart instance
const MAX_RUNS = 12;    // the leak is capped for this demo

// Everything the chart attaches to the outside world, so the demo can count it and really undo it.
interface Leak { id: number; symbol: string; onResize: () => void; onScroll: () => void; interval: ReturnType<typeof setInterval>; bytes: number }
interface Registry { live: Map<number, Leak>; seq: number }

function PriceChart({ symbol, fixed, registry, onTick, onChange }: {
  symbol: string; fixed: boolean; registry: Registry; onTick: (symbol: string) => void; onChange: () => void;
}) {
  const [last, setLast] = useState(0);
  useEffect(() => {
    // A real allocation: the closures below keep this array alive as long as they are registered.
    const history = new Float64Array(POINTS).map((_, i) => 100 + Math.sin(i / 500) * 5);
    const onResize = () => setLast(history[history.length - 1]);
    const onScroll = () => { let max = 0; for (let i = 0; i < history.length; i += 50) max = Math.max(max, history[i]); return max; };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    const interval = setInterval(() => onTick(symbol), 1000); // "redraw / poll"
    const id = ++registry.seq;
    registry.live.set(id, { id, symbol, onResize, onScroll, interval, bytes: history.byteLength });
    onChange();
    setLast(history[history.length - 1]);
    if (!fixed) return; // BUG: no cleanup, so listeners, interval and `history` outlive the chart
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      clearInterval(interval);
      registry.live.delete(id);
      onChange();
    };
  }, [symbol, fixed, registry, onTick, onChange]);

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}>
      <Row><strong>{symbol}</strong><Badge tone="good">${last.toFixed(2)}</Badge></Row>
      <svg viewBox="0 0 200 40" width="100%" height="40" aria-hidden>
        <polyline fill="none" stroke="var(--info)" strokeWidth="2" points={Array.from({ length: 20 }, (_, i) => `${i * 10.5},${20 + Math.sin(i + symbol.length) * 12}`).join(' ')} />
      </svg>
    </div>
  );
}

function Dashboard({ fixed }: { fixed: boolean }) {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState(SYMBOLS[0]);
  const [, force] = useState(0);
  const [ticks, setTicks] = useState(0);
  const registry = useRef<Registry>({ live: new Map(), seq: 0 }).current;
  const c = useConsole();
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;
  const openRef = useRef(open);
  openRef.current = open;

  const onChange = useRef(() => force((n) => n + 1)).current;
  const onTick = useRef((s: string) => {
    setTicks((n) => n + 1);
    if (!openRef.current || s !== symbolRef.current) c.log(`poll /quotes/${s} from a chart that is no longer on screen`, 'warn');
  }).current;

  const clearAll = () => {
    registry.live.forEach((l) => {
      window.removeEventListener('resize', l.onResize);
      window.removeEventListener('scroll', l.onScroll);
      clearInterval(l.interval);
    });
    registry.live.clear();
  };
  // The demo frame itself never leaks: unmounting the demo really clears everything.
  useEffect(() => clearAll, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => { setOpen(false); clearAll(); registry.seq = 0; setTicks(0); c.clear(); force((n) => n + 1); };

  const live = registry.live.size;
  const mb = [...registry.live.values()].reduce((s, l) => s + l.bytes, 0) / 1_048_576;
  const capped = registry.seq >= MAX_RUNS;

  return (
    <Stack gap={14}>
      <Browser url="trade.northstar.example/dashboard">
        <Stack gap={10}>
          <Row>
            <Button tone="primary" onClick={() => setOpen((o) => !o)} disabled={!open && capped}>{open ? 'Close chart' : 'Open chart'}</Button>
            {open && SYMBOLS.map((s) => (
              <Button key={s} tone={s === symbol ? 'default' : 'ghost'} disabled={s !== symbol && capped} onClick={() => setSymbol(s)}>{s}</Button>
            ))}
          </Row>
          {open ? <PriceChart symbol={symbol} fixed={fixed} registry={registry} onTick={onTick} onChange={onChange} /> : <Note>Chart panel closed.</Note>}
          {capped && <Note>Capped at {MAX_RUNS} chart mounts for this demo. Press Reset.</Note>}
        </Stack>
      </Browser>
      <Row gap={8}>
        <Stat label="window listeners (resize + scroll)" value={live * 2} tone={live > 1 ? 'bad' : 'neutral'} />
        <Stat label="intervals running" value={live} tone={live > 1 ? 'bad' : 'neutral'} />
        <Stat label="retained by closures" value={`${mb.toFixed(1)} MB`} tone={live > 1 ? 'bad' : 'neutral'} />
        <Stat label="polls fired" value={ticks} />
      </Row>
      <Row><Button tone="ghost" onClick={reset}>Reset (remove everything)</Button></Row>
      <Code>{fixed
        ? `useEffect(() => {
  window.addEventListener('resize', onResize);
  const id = setInterval(redraw, 1000);
  return () => { window.removeEventListener('resize', onResize); clearInterval(id); };
}, [symbol]);`
        : `useEffect(() => {
  window.addEventListener('resize', () => chart.resize()); // never removed
  setInterval(() => chart.redraw(), 1000);                 // never cleared
}, [symbol]);`}</Code>
      <Console lines={c.lines} height={120} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <Dashboard fixed={false} />;
}

export function Solution() {
  return <Dashboard fixed />;
}
