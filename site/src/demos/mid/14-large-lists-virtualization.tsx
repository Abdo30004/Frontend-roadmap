import { memo, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type RefObject } from 'react';
import { Badge, Browser, Button, Code, Input, Note, Row, Stack, Stat, type Tone } from '../../demo-kit';

export const scenario = 'A logistics admin panel shows every shipment in one scrollable table, with a search box to filter by customer.';
export const task = 'Click "Load shipments", then type "acme" quickly in the search box and scroll the table. Watch the stats.';
export const solutionNote = '50,000 shipments, but only the rows inside the scroll viewport exist in the DOM.';

interface Shipment { id: number; tracking: string; customer: string; customerLower: string; status: string; eta: number }

const CUSTOMERS = ['Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark Ind.', 'Wayne Ent.', 'Wonka', 'Tyrell', 'Cyberdyne'];
const STATUSES: [string, Tone][] = [['In transit', 'info'], ['Delivered', 'good'], ['Delayed', 'bad'], ['At depot', 'warn']];
const ROW_H = 34;
const VIEW_H = 300;
const OVERSCAN = 4;
const BASE = Date.UTC(2026, 10, 15, 8, 0);

function makeShipments(n: number): Shipment[] {
  const out: Shipment[] = [];
  for (let i = 0; i < n; i++) {
    const customer = `${CUSTOMERS[(i * 7) % CUSTOMERS.length]} #${(i * 37) % 1000}`;
    out.push({ id: i, tracking: `SH-${String(100000 + i)}`, customer, customerLower: customer.toLowerCase(), status: String(i % 4), eta: BASE + i * 3_600_000 });
  }
  return out;
}

// A typical row: it formats a date on every render (cheap once, expensive x 3,000).
function ShipmentRow({ s, style }: { s: Shipment; style?: CSSProperties }) {
  const [label, tone] = STATUSES[Number(s.status)];
  const eta = new Date(s.eta).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return (
    <div role="row" style={{ display: 'grid', gridTemplateColumns: '92px 130px 96px 1fr', alignItems: 'center', height: ROW_H, padding: '0 10px', borderBottom: '1px solid var(--line)', fontSize: 13, boxSizing: 'border-box', background: 'var(--surface)', ...style }}>
      <span role="cell" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.tracking}</span>
      <span role="cell">{s.customer}</span>
      <span role="cell"><Badge tone={tone}>{label}</Badge></span>
      <span role="cell" style={{ color: 'var(--ink-3)' }}>{eta}</span>
    </div>
  );
}

const boxStyle: CSSProperties = { height: VIEW_H, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 8 };

// Naive: one DOM row per shipment.
const NaiveTable = memo(function NaiveTable({ rows, boxRef }: { rows: Shipment[]; boxRef: RefObject<HTMLDivElement>; onScrolled: () => void }) {
  return (
    <div ref={boxRef} role="table" style={boxStyle}>
      <div style={{ minWidth: 440 }}>
        {rows.map((s) => <ShipmentRow key={s.id} s={s} />)}
      </div>
    </div>
  );
});

// Hand-written windowing: a tall spacer + only the visible rows, positioned with transform.
const VirtualTable = memo(function VirtualTable({ rows, boxRef, onScrolled }: { rows: Shipment[]; boxRef: RefObject<HTMLDivElement>; onScrolled: () => void }) {
  const [scrollTop, setScrollTop] = useState(0);
  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((scrollTop + VIEW_H) / ROW_H) + OVERSCAN);
  return (
    <div ref={boxRef} role="table" style={boxStyle} onScroll={(e) => { setScrollTop(e.currentTarget.scrollTop); onScrolled(); }}>
      <div style={{ position: 'relative', height: rows.length * ROW_H, minWidth: 440 }}>
        {rows.slice(first, last).map((s, i) => (
          <ShipmentRow key={s.id} s={s} style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${(first + i) * ROW_H}px)` }} />
        ))}
      </div>
    </div>
  );
});

interface Metrics { rows: number; nodes: number; ms: number | null; worst: number; what: string }

function ShipmentsPage({ virtual }: { virtual: boolean }) {
  const total = virtual ? 50_000 : 3_000;
  const [data, setData] = useState<Shipment[] | null>(null);
  const [query, setQuery] = useState('');
  const [m, setM] = useState<Metrics>({ rows: 0, nodes: 0, ms: null, worst: 0, what: '' });
  const boxRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => { cancelAnimationFrame(raf.current); clearTimeout(timer.current); }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return q ? data.filter((s) => s.customerLower.includes(q)) : data;
  }, [data, query]);

  // Measure "input → next frame": rAF runs after React committed, the timeout after the paint.
  const measure = useCallback((t0: number | null, what: string) => {
    cancelAnimationFrame(raf.current);
    clearTimeout(timer.current);
    raf.current = requestAnimationFrame(() => {
      timer.current = setTimeout(() => {
        const box = boxRef.current;
        const ms = t0 === null ? null : Math.round(performance.now() - t0);
        setM((prev) => ({
          rows: box ? box.querySelectorAll('[role=row]').length : 0,
          nodes: box ? box.querySelectorAll('*').length + 1 : 0,
          ms: ms ?? prev.ms,
          worst: Math.max(prev.worst, ms ?? 0),
          what: ms === null ? prev.what : what,
        }));
      }, 0);
    });
  }, []);
  const onScrolled = useCallback(() => measure(null, ''), [measure]);

  const load = () => {
    const shipments = makeShipments(total);
    const t0 = performance.now();
    setQuery('');
    setData(shipments);
    measure(t0, 'initial render');
  };

  const onType = (e: ChangeEvent<HTMLInputElement>) => {
    const now = performance.now();
    const t0 = e.timeStamp > 0 && e.timeStamp <= now ? e.timeStamp : now; // includes time the keystroke waited in the queue
    setQuery(e.target.value);
    if (boxRef.current) boxRef.current.scrollTop = 0;
    measure(t0, 'last keystroke');
  };

  const msTone: Tone = m.ms === null ? 'neutral' : m.ms > 50 ? 'bad' : m.ms > 16 ? 'warn' : 'good';
  const Table = virtual ? VirtualTable : NaiveTable;

  return (
    <Stack gap={14}>
      <Browser url="ops.shipfast.example/admin/shipments">
        <Stack gap={10}>
          <Row>
            <Button tone="primary" onClick={load}>{data ? 'Reload' : 'Load'} shipments</Button>
            <Input value={query} onChange={onType} disabled={!data} placeholder="Search customer…" aria-label="Search customer" style={{ flex: '1 1 140px' }} />
          </Row>
          {data ? (
            <>
              <Note>{filtered.length.toLocaleString('en-US')} of {total.toLocaleString('en-US')} shipments</Note>
              <Table rows={filtered} boxRef={boxRef} onScrolled={onScrolled} />
            </>
          ) : (
            <Note>{total.toLocaleString('en-US')} shipments ready to load.</Note>
          )}
        </Stack>
      </Browser>
      <Row gap={8}>
        <Stat label="rows in the DOM" value={m.rows.toLocaleString('en-US')} tone={m.rows > 500 ? 'bad' : m.rows ? 'good' : 'neutral'} />
        <Stat label="DOM nodes in table" value={m.nodes.toLocaleString('en-US')} tone={m.nodes > 5000 ? 'bad' : m.nodes ? 'good' : 'neutral'} />
        <Stat label={m.what ? `${m.what} → paint (ms)` : 'update → paint (ms)'} value={m.ms ?? '–'} tone={msTone} />
        <Stat label="slowest update (ms)" value={m.worst || '–'} tone={m.worst > 50 ? 'bad' : m.worst ? 'good' : 'neutral'} />
      </Row>
      <Code>{virtual
        ? `const first = Math.floor(scrollTop / ROW_H) - OVERSCAN;
const last  = Math.ceil((scrollTop + VIEW_H) / ROW_H) + OVERSCAN;
<div style={{ height: rows.length * ROW_H, position: 'relative' }}>
  {rows.slice(first, last).map((s, i) => <ShipmentRow key={s.id} s={s}
     style={{ position: 'absolute', transform: \`translateY(\${(first + i) * ROW_H}px)\` }} />)}
</div>`
        : `<div style={{ height: 300, overflow: 'auto' }}>
  {filtered.map((s) => <ShipmentRow key={s.id} s={s} />)}  {/* every row, always */}
</div>`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <ShipmentsPage virtual={false} />;
}

export function Solution() {
  return <ShipmentsPage virtual />;
}
