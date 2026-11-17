import { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Browser,
  Button,
  Code,
  Console,
  Input,
  Label,
  Note,
  Panel,
  Row,
  Stack,
  Stat,
  sleep,
  useConsole,
  type Tone,
} from '../../demo-kit';

export const scenario = 'Sales reps take shop orders on a phone web app, often in basement stock rooms where the signal comes and goes.';
export const task =
  'Set "No signal", submit an order, press "Next shop", then go back to "Good signal". Also try one order on "Weak signal" and submit twice.';
export const solutionNote = 'Orders go to an IndexedDB outbox first (client UUID), then sync idempotently when the signal returns.';

type Net = 'online' | 'flaky' | 'offline';
const NETS: { id: Net; label: string; bars: number; tone: Tone }[] = [
  { id: 'online', label: 'Good signal', bars: 4, tone: 'good' },
  { id: 'flaky', label: 'Weak signal', bars: 1, tone: 'warn' },
  { id: 'offline', label: 'No signal', bars: 0, tone: 'bad' },
];
const SHOPS = ['Corner Market #12', 'Bella Deli', 'Kiosk Nord', 'FreshMart Ave', 'Mini Stop 7', 'Late Shop', 'Station Kiosk'];
const CACHED_PRICE = 1.2; // catalog cached on the phone yesterday
const HQ_PRICE = 1.35; // back office changed the price while the rep was underground

interface Order {
  id: string;
  shop: string;
  qty: number;
  price: number;
}
interface HqRow extends Order {
  label: string;
  merged?: boolean;
}

const uuid = () => Math.random().toString(16).slice(2, 10);

function Bars({ n }: { n: number }) {
  return (
    <span aria-hidden style={{ display: 'inline-flex', gap: 2, alignItems: 'flex-end', marginRight: 6 }}>
      {[1, 2, 3, 4].map((i) => (
        <i
          key={i}
          style={{
            width: 3,
            height: 3 + i * 3,
            borderRadius: 1,
            background: i <= n ? 'currentColor' : 'var(--line-2)',
            transition: 'background-color 200ms ease',
          }}
        />
      ))}
    </span>
  );
}

function SalesApp({ fixed }: { fixed: boolean }) {
  const [net, setNet] = useState<Net>('online');
  const [hq, setHq] = useState<HqRow[]>([]);
  const [outbox, setOutbox] = useState<Order[]>([]);
  const [taken, setTaken] = useState<string[]>([]);
  const [shopIdx, setShopIdx] = useState(0);
  const [qty, setQty] = useState('6');
  const [formId, setFormId] = useState(uuid);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [price, setPrice] = useState(CACHED_PRICE);
  const c = useConsole();

  const ac = useRef(new AbortController());
  useEffect(() => () => ac.current.abort(), []);
  const netRef = useRef(net);
  netRef.current = net;
  const hqRef = useRef<HqRow[]>([]);
  const boxRef = useRef<Order[]>([]);
  const syncing = useRef(false);
  const writeHq = (rows: HqRow[]) => {
    hqRef.current = rows;
    setHq(rows);
  };
  const writeBox = (rows: Order[]) => {
    boxRef.current = rows;
    setOutbox(rows);
  };

  const nextShop = () => {
    setShopIdx((i) => (i + 1) % SHOPS.length);
    setQty(String(2 + Math.floor(Math.random() * 10)));
    setFormId(uuid());
    setStatus('idle');
  };

  // FIXED: drain the outbox. Server upserts by client id, so a retry never duplicates.
  const flush = async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      for (const entry of [...boxRef.current]) {
        if (netRef.current === 'offline') {
          c.log('offline again: outbox kept for later', 'warn');
          break;
        }
        c.log(`PUT /api/orders/${entry.id}  (Idempotency-Key)`, 'info');
        await sleep(650, ac.current.signal);
        if (hqRef.current.some((r) => r.id === entry.id)) {
          c.log(`200 already stored → no duplicate created`, 'good');
        } else if (entry.price !== HQ_PRICE) {
          c.log(`409 Conflict: HQ price is €${HQ_PRICE.toFixed(2)}, phone had €${entry.price.toFixed(2)}`, 'warn');
          c.log(`merge rule: server wins price, rep wins qty (${entry.qty}) → PUT again → 200`, 'good');
          writeHq([...hqRef.current, { ...entry, price: HQ_PRICE, label: entry.id, merged: true }]);
          setPrice(HQ_PRICE);
        } else {
          writeHq([...hqRef.current, { ...entry, label: entry.id }]);
        }
        if (netRef.current === 'flaky') {
          c.log('weak signal: response lost → entry stays in outbox, retried later', 'warn');
          continue;
        }
        writeBox(boxRef.current.filter((o) => o.id !== entry.id));
      }
    } catch {
      /* aborted on unmount */
    } finally {
      syncing.current = false;
    }
  };

  // The `online` event (Background Sync fallback) triggers a flush.
  useEffect(() => {
    if (fixed && net !== 'offline') flush();
  }, [net]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const order: Order = { id: formId, shop: SHOPS[shopIdx], qty: Number(qty) || 1, price };
    setTaken((t) => (t.includes(order.id) ? t : [...t, order.id]));
    if (fixed) {
      writeBox([...boxRef.current, order]); // durable before any network call
      c.log(`IndexedDB put outbox/${order.id} (${order.shop}, ${order.qty} cases)`, 'neutral');
      nextShop();
      if (netRef.current !== 'offline') flush();
      return;
    }
    // BROKEN: online-only POST, no client id, order lives only in React state
    setStatus('saving');
    c.log(`POST /api/orders { shop: "${order.shop}", qty: ${order.qty} }`, 'info');
    try {
      await sleep(700, ac.current.signal);
    } catch {
      return;
    }
    const sent = netRef.current;
    if (sent === 'offline') {
      c.log('TypeError: Failed to fetch', 'bad');
      setStatus('error');
      return;
    }
    writeHq([...hqRef.current, { ...order, label: `srv-${hqRef.current.length + 101}` }]);
    if (sent === 'flaky') {
      c.log('request reached HQ, but the response was lost → "Network error"', 'bad');
      setStatus('error');
      return;
    }
    c.log('201 Created', 'good');
    nextShop();
  };

  const reset = () => {
    writeHq([]);
    writeBox([]);
    setTaken([]);
    c.clear();
    setShopIdx(0);
    setFormId(uuid());
    setStatus('idle');
    setNet('online');
    setPrice(CACHED_PRICE);
  };

  const refs = new Set(hq.map((r) => r.id));
  const missing = taken.filter((id) => !refs.has(id) && !outbox.some((o) => o.id === id)).length;
  const dupes = hq.length - refs.size;
  const cur = NETS.find((n) => n.id === net)!;

  return (
    <Stack gap={14}>
      <Browser url="sales.fieldpro.example/orders/new">
        <Stack gap={12}>
          <Row style={{ justifyContent: 'space-between' }}>
            <strong>{SHOPS[shopIdx]}</strong>
            <Row gap={6}>
              {fixed && outbox.length > 0 && <Badge tone="warn">Pending sync ({outbox.length})</Badge>}
              <Badge tone={cur.tone}>
                <Bars n={cur.bars} />
                {cur.label}
              </Badge>
            </Row>
          </Row>
          <Row gap={10} align="flex-end">
            <Label text="Cola 24-pack (cases)">
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                style={{ width: 110 }}
                disabled={status === 'saving'}
              />
            </Label>
            <Note>€{price.toFixed(2)}/can (cached catalog)</Note>
          </Row>
          {status === 'error' && <Badge tone="bad">Something went wrong. Please try again.</Badge>}
          <Row>
            <Button tone="primary" onClick={submit} disabled={status === 'saving'}>
              {status === 'saving' ? 'Submitting…' : 'Submit order'}
            </Button>
            <Button onClick={nextShop} disabled={status === 'saving'}>
              Next shop
            </Button>
          </Row>
        </Stack>
      </Browser>

      <Row gap={6}>
        <Note>Signal in the stock room:</Note>
        {NETS.map((n) => (
          <Button key={n.id} tone={net === n.id ? 'primary' : 'default'} onClick={() => setNet(n.id)} aria-pressed={net === n.id}>
            <Bars n={n.bars} />
            {n.label}
          </Button>
        ))}
        <Button tone="ghost" onClick={reset}>
          Reset
        </Button>
      </Row>

      <Row gap={8}>
        <Stat label="Orders taken" value={taken.length} />
        <Stat label="Received at HQ" value={hq.length} tone={hq.length ? 'info' : 'neutral'} />
        <Stat label="Missing at HQ" value={missing} tone={missing ? 'bad' : 'good'} />
        <Stat label="Duplicates" value={dupes} tone={dupes ? 'bad' : 'good'} />
      </Row>

      <Row gap={10} align="stretch">
        <Panel title="HQ orders table" style={{ flex: '1 1 220px', overflowX: 'auto' }}>
          {hq.length === 0 ? (
            <Note>No orders yet.</Note>
          ) : (
            <Stack gap={4}>
              {hq.map((r, i) => (
                <Row key={i} gap={6} wrap={false} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                  <code>{r.label}</code> {r.shop} · {r.qty} × €{r.price.toFixed(2)}
                  {r.merged && <Badge tone="warn">conflict resolved</Badge>}
                </Row>
              ))}
            </Stack>
          )}
        </Panel>
        {fixed && (
          <Panel title="IndexedDB · outbox" style={{ flex: '1 1 160px' }}>
            {outbox.length === 0 ? (
              <Note>Empty: everything synced.</Note>
            ) : (
              outbox.map((o) => (
                <div key={o.id} style={{ fontSize: 13 }}>
                  <code>{o.id}</code> {o.shop}
                </div>
              ))
            )}
          </Panel>
        )}
      </Row>

      <Code>
        {fixed
          ? `await db.put('outbox', { ...order, id: crypto.randomUUID() });\nwindow.addEventListener('online', flushOutbox);\n// flush: PUT /api/orders/:id + Idempotency-Key, 409 → merge`
          : `await fetch('/api/orders', { method: 'POST', body });  // no client id\n} catch { setStatus('error'); }  // order only in React state`}
      </Code>
      <Console lines={c.lines} height={130} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <SalesApp fixed={false} />;
}

export function Solution() {
  return <SalesApp fixed />;
}
