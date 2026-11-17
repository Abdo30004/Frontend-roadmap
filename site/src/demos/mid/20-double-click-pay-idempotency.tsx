import { useEffect, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Note, Row, Stack, Stat, sleep, useConsole } from '../../demo-kit';

export const scenario =
  'A ticketing site sells presale concert tickets. The payment API is slow during the rush, so users get impatient on the Pay button.';
export const task = 'Click "⚡ Double-click Pay" (two clicks in the same frame), then Reset, tick "Flaky network" and click Pay once.';
export const solutionNote =
  'Same button: the guard is a ref (synchronous), and every attempt carries an Idempotency-Key the server dedupes.';

const AMOUNT = 120;
interface Charge {
  id: string;
  key: string | null;
}
type Stored = { status: 'processing' } | { status: 'done'; chargeId: string };

function Checkout({ fixed }: { fixed: boolean }) {
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [flaky, setFlaky] = useState(false);
  const [charges, setCharges] = useState<Charge[]>([]);
  const inFlight = useRef(false);
  const idemKey = useRef(newKey());
  const server = useRef(new Map<string, Stored>()); // the fake server's idempotency table
  const seq = useRef(0);
  const life = useRef(new AbortController());
  const btn = useRef<HTMLButtonElement>(null);
  const c = useConsole();

  useEffect(() => () => life.current.abort(), []);

  // ---- fake server: POST /payments ----
  async function serverCharge(key: string | null): Promise<string> {
    await sleep(900, life.current.signal);
    if (fixed && key) {
      const prev = server.current.get(key);
      if (prev?.status === 'done') {
        c.log(`server: key ${key} already used → replay ${prev.chargeId}, no new charge`, 'good');
        return prev.chargeId;
      }
      if (prev?.status === 'processing') {
        c.log(`server: key ${key} in progress → 409`, 'warn');
        throw new Error('409');
      }
      server.current.set(key, { status: 'processing' });
    }
    const chargeId = `ch_${++seq.current}`;
    setCharges((list) => [...list, { id: chargeId, key }]);
    if (key) server.current.set(key, { status: 'done', chargeId });
    c.log(`server: card charged €${AMOUNT} → ${chargeId}`, fixed ? 'info' : 'warn');
    return chargeId;
  }

  // ---- client API with retry (like axios-retry) ----
  async function post(key: string | null) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const chargeId = await serverCharge(key);
      if (flaky && attempt === 1) {
        c.log('client: response lost (network timeout) → retrying POST', 'warn');
        continue;
      }
      return chargeId;
    }
    throw new Error('failed');
  }

  async function handlePay(click: number) {
    if (fixed) {
      if (inFlight.current) {
        c.log(`click ${click}: blocked by inFlight ref`, 'good');
        return;
      }
      inFlight.current = true;
    } else if (loading) {
      c.log(`click ${click}: blocked by loading state`, 'good');
      return;
    }
    c.log(
      `click ${click}: loading = ${String(loading)} → POST /payments${fixed ? ` (Idempotency-Key: ${idemKey.current})` : ''}`,
      fixed ? 'info' : 'warn',
    );
    setLoading(true);
    try {
      await post(fixed ? idemKey.current : null);
      setPaid(true);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      if (fixed) inFlight.current = false; // allow a retry with the SAME key
    }
    setLoading(false);
  }

  const clicks = useRef(0);
  const doubleClick = () => {
    btn.current?.click();
    btn.current?.click();
  }; // both in one task, before React re-renders
  const reset = () => {
    setCharges([]);
    setPaid(false);
    setLoading(false);
    c.clear();
    inFlight.current = false;
    idemKey.current = newKey();
    clicks.current = 0;
    server.current.clear();
  };

  const total = charges.length * AMOUNT;
  return (
    <Stack gap={14}>
      <Browser url="tixly.example/checkout/presale-4417">
        <Stack gap={10}>
          <strong>2 × Standing · Arctic Lights, 14 Mar</strong>
          <Note>Card •••• 4242</Note>
          {paid ? (
            <Badge tone="good">✓ Payment confirmed</Badge>
          ) : (
            <Row>
              <button
                ref={btn}
                type="button"
                className="dk-btn"
                data-tone="primary"
                disabled={loading}
                aria-busy={loading}
                onClick={() => handlePay(++clicks.current)}
              >
                {loading ? 'Processing payment…' : `Pay €${AMOUNT}`}
              </button>
            </Row>
          )}
        </Stack>
      </Browser>
      <Row>
        <Button onClick={doubleClick} disabled={paid || loading}>
          ⚡ Double-click Pay
        </Button>
        <label style={{ fontSize: 13, color: 'var(--ink-2)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={flaky} onChange={(e) => setFlaky(e.target.checked)} /> Flaky network (1st response lost)
        </label>
        <Button tone="ghost" onClick={reset}>
          Reset
        </Button>
      </Row>
      <Row gap={8}>
        <Stat label="charges on card" value={charges.length} tone={charges.length > 1 ? 'bad' : charges.length ? 'good' : 'neutral'} />
        <Stat label="total charged" value={`€${total}`} tone={total > AMOUNT ? 'bad' : 'neutral'} />
      </Row>
      <Code>
        {fixed
          ? `if (inFlight.current) return;   // a ref changes synchronously
inFlight.current = true;
await api.post('/payments', body, { headers: { 'Idempotency-Key': key.current }, retry: 2 });`
          : `if (loading) return;            // both clicks read the same, stale loading=false
setLoading(true);               // the re-render happens after both clicks
await api.post('/payments', body, { retry: 2 });  // a retry is a new charge`}
      </Code>
      <Console lines={c.lines} height={140} onClear={c.clear} />
    </Stack>
  );
}

function newKey() {
  return `k_${Math.random().toString(36).slice(2, 8)}`;
}

export function Problem() {
  return <Checkout fixed={false} />;
}

export function Solution() {
  return <Checkout fixed />;
}
