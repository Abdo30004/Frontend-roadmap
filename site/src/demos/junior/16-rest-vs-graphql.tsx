import { useEffect, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Note, Row, Stack, Stat, sleep } from '../../demo-kit';

export const scenario = 'A shop\'s mobile "My orders" screen on a 3G connection: it shows your name and your last orders with a product name each.';
export const task = 'Press "Open My orders" and watch the network panel fill up. Compare requests, KB and time to screen.';
export const solutionNote = 'Same screen, one GraphQL query that asks for exactly the fields it renders.';

const RTT = 280; // simulated 3G round trip (ms), real time in this demo
const ORDERS = [
  { id: 'A-1041', product: 'Trail running shoes', status: 'Delivered', total: 89.9 },
  { id: 'A-1038', product: 'Merino socks (3 pack)', status: 'Delivered', total: 24.0 },
  { id: 'A-1032', product: 'Rain jacket', status: 'Shipped', total: 129.0 },
  { id: 'A-1027', product: 'Water bottle 750ml', status: 'Delivered', total: 15.5 },
  { id: 'A-1019', product: 'Headlamp', status: 'Returned', total: 39.0 },
  { id: 'A-1012', product: 'Hiking poles', status: 'Delivered', total: 64.0 },
];

interface Req { label: string; kb: number; usedKb: number; start: number; end: number }

function OrdersScreen({ fixed }: { fixed: boolean }) {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => ctrl.current?.abort(), []);

  const open = async () => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setReqs([]);
    setPhase('loading');
    const t0 = performance.now();
    const call = async (label: string, kb: number, usedKb: number, ms = RTT) => {
      const start = performance.now() - t0;
      await sleep(ms, c.signal);
      const r = { label, kb, usedKb, start, end: performance.now() - t0 };
      setReqs((prev) => [...prev, r]);
    };
    try {
      if (fixed) {
        // One POST /graphql, the server resolves user → orders → product (batched with DataLoader).
        await call('POST /graphql  query OrdersScreen', 2.1, 2.1, RTT + 120);
      } else {
        await call('GET /api/users/42', 1.4, 0.05);
        await call('GET /api/users/42/orders', 3.2, 1.0);
        for (const o of ORDERS) {
          // sequential: each product waits for the previous one
          await call(`GET /api/products/${o.id.slice(2)}`, 30, 0.12);
        }
      }
      setElapsed(performance.now() - t0);
      setPhase('done');
    } catch {
      /* aborted (unmount or re-open) */
    }
  };

  const total = reqs.reduce((s, r) => s + r.kb, 0);
  const used = reqs.reduce((s, r) => s + r.usedKb, 0);
  const span = Math.max(1, ...reqs.map((r) => r.end));

  return (
    <Stack gap={14}>
      <Row>
        <Button tone="primary" onClick={open} disabled={phase === 'loading'}>Open My orders</Button>
        <Badge tone="info">3G · ~{RTT} ms per round trip</Badge>
      </Row>

      <Row gap={12} align="flex-start">
        <div style={{ flex: '1 1 220px', maxWidth: 280 }}>
          <Browser url="m.shop.example/orders">
            {phase === 'idle' && <Note>Screen not opened yet.</Note>}
            {phase === 'loading' && (
              <Stack gap={8}>
                <Note>Loading your orders…</Note>
                {[0, 1, 2].map((i) => <div key={i} style={{ height: 34, borderRadius: 8, background: 'var(--paper-2)' }} />)}
              </Stack>
            )}
            {phase === 'done' && (
              <Stack gap={6}>
                <strong>Hi Maya 👋</strong>
                {ORDERS.map((o) => (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                    <span>📦 {o.product}<br /><small style={{ color: 'var(--ink-3)' }}>{o.status}</small></span>
                    <span>€{o.total.toFixed(2)}</span>
                  </div>
                ))}
              </Stack>
            )}
          </Browser>
        </div>

        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Network</div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 240, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {reqs.length === 0 && <Note>No requests yet.</Note>}
              {reqs.map((r, i) => (
                <div key={i} style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, color: 'var(--ink-2)' }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
                    <span style={{ color: r.kb > 10 ? 'var(--bad)' : 'var(--ink-3)' }}>{r.kb} KB</span>
                  </div>
                  <div style={{ position: 'relative', height: 6, background: 'var(--paper-2)', borderRadius: 3 }}>
                    <div style={{ position: 'absolute', height: 6, borderRadius: 3, left: `${(r.start / span) * 100}%`, width: `${Math.max(1.5, ((r.end - r.start) / span) * 100)}%`, background: fixed ? 'var(--good)' : 'var(--info)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Row>

      <Row gap={8}>
        <Stat label="requests" value={reqs.length} tone={reqs.length > 2 ? 'bad' : reqs.length ? 'good' : 'neutral'} />
        <Stat label="KB downloaded" value={total.toFixed(1)} tone={total > 20 ? 'bad' : total ? 'good' : 'neutral'} />
        <Stat label="KB actually shown" value={used.toFixed(1)} />
        <Stat label="time to screen" value={phase === 'done' ? `${(elapsed / 1000).toFixed(1)} s` : '-'} tone={phase !== 'done' ? 'neutral' : elapsed > 1000 ? 'bad' : 'good'} />
      </Row>

      <Code>{fixed
        ? `query OrdersScreen($userId: ID!) {\n  user(id: $userId) {\n    firstName\n    orders(last: 6) { id status total product { name } }\n  }\n}`
        : `const user = await get(\`/api/users/\${id}\`);\nconst orders = await get(\`/api/users/\${id}/orders\`);\nfor (const order of orders) {\n  const product = await get(\`/api/products/\${order.productId}\`); // 30 KB\n  order.productName = product.name;                               // uses 1 field\n}`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <OrdersScreen fixed={false} />;
}

export function Solution() {
  return <OrdersScreen fixed />;
}
