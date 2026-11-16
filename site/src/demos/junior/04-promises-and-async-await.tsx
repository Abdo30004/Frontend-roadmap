import { useEffect, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Note, Row, Stack, Stat, fakeRequest, useConsole } from '../../demo-kit';

export const scenario = 'A travel checkout page loads your profile, cart and payment methods, then asks the pricing API for the total before showing "Pay".';
export const task = 'Press "Load checkout" and check the load time and total. Then turn on "Payments API down" and load again.';
export const solutionNote = 'Same APIs: Promise.all for independent calls, await on the total, res.ok check and try/catch/finally.';

interface FakeResponse { ok: boolean; status: number; json: () => Promise<unknown> }
interface Cart { items: { name: string; price: number }[] }
interface View { name: string; items: string[]; methods: string; total: string }

const DATA: Record<string, unknown> = {
  '/api/profile': { name: 'Ana Ruiz' },
  '/api/cart': { items: [{ name: 'Flight Lisbon → Rome', price: 129 }, { name: 'Hotel, 2 nights', price: 240 }] },
  '/api/payment-methods': { list: ['Visa ••42', 'PayPal'] },
};

function CheckoutDemo({ fixed }: { fixed: boolean }) {
  const c = useConsole();
  const [paymentsDown, setPaymentsDown] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [view, setView] = useState<View | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const run = useRef(0);
  const pending = useRef(new Set<Promise<void>>());

  // Real unhandled rejections from THIS demo's promises are mirrored into the console below.
  useEffect(() => {
    const onUnhandled = (e: PromiseRejectionEvent) => {
      if (!pending.current.has(e.promise)) return;
      c.log(`Uncaught (in promise) ${String(e.reason)}`, 'bad');
    };
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => window.removeEventListener('unhandledrejection', onUnhandled);
  }, [c.log]);

  const load = () => {
    const id = ++run.current;
    const t0 = performance.now();
    const stamp = () => `+${((performance.now() - t0) / 1000).toFixed(1)}s`;
    const current = () => id === run.current;
    c.clear();
    setView(null);
    setElapsed(null);

    // fetch() look-alike: resolves even on HTTP 500, like the real one.
    const fakeFetch = async (url: string, delay = 900): Promise<FakeResponse> => {
      c.log(`${stamp()} → ${url}`, 'info');
      const down = url === '/api/payment-methods' && paymentsDown;
      const res = await fakeRequest<FakeResponse>({
        ok: !down,
        status: down ? 500 : 200,
        json: async () => (down ? { error: 'Internal Server Error' } : DATA[url]),
      }, { delay });
      c.log(`${stamp()} ← ${url} ${res.status}`, res.ok ? 'good' : 'bad');
      return res;
    };
    const pricing = async (cart: Cart) => {
      const res = await fakeFetch('/api/pricing', 400);
      await res.json();
      return { total: cart.items.reduce((s, i) => s + i.price, 0) + 37.5 };
    };
    const renderCheckout = (p: { name: string }, cart: Cart, methods: { list: string[] }, total: unknown) => {
      if (!current()) return;
      setView({
        name: p.name,
        items: cart.items.map((i) => `${i.name} · $${i.price}`),
        methods: methods.list.join(' · '),
        total: `$${total}`,
      });
      setElapsed(performance.now() - t0);
    };
    const spinner = (on: boolean) => { if (current()) setStatus(on ? 'loading' : 'ready'); };

    if (!fixed) {
      // BROKEN: one after another, no await on pricing, no res.ok check, no catch
      const loadCheckout = async () => {
        spinner(true);
        const profile: any = await fakeFetch('/api/profile').then((r) => r.json());
        const cart: any = await fakeFetch('/api/cart').then((r) => r.json());
        const methods: any = await fakeFetch('/api/payment-methods').then((r) => r.json());
        const quote: any = pricing(cart); // async function, missing await
        renderCheckout(profile, cart, methods, quote.total);
        spinner(false); // never reached if anything throws
      };
      const p = loadCheckout(); // no .catch()
      pending.current.add(p);
      return;
    }

    // FIXED
    const getJSON = async (url: string) => {
      const res = await fakeFetch(url);
      if (!res.ok) throw new Error(`${url} failed with status ${res.status}`);
      return res.json();
    };
    const loadCheckout = async () => {
      spinner(true);
      try {
        const [profile, cart, methods] = await Promise.all([
          getJSON('/api/profile'), getJSON('/api/cart'), getJSON('/api/payment-methods'),
        ]);
        const quote = await pricing(cart as Cart);
        renderCheckout(profile as { name: string }, cart as Cart, methods as { list: string[] }, quote.total.toFixed(2));
      } catch (err) {
        if (current()) setStatus('error');
        c.log(`caught: ${(err as Error).message}`, 'warn');
      } finally {
        if (current()) setStatus((s) => (s === 'error' ? 'error' : 'ready'));
      }
    };
    loadCheckout();
  };

  const slow = elapsed !== null && elapsed > 2000;

  return (
    <Stack gap={14}>
      <Browser url="trips.example/checkout">
        <Stack gap={10}>
          {status === 'idle' && <Note>Checkout not loaded yet.</Note>}
          {status === 'loading' && <Row gap={8}><span aria-hidden>⏳</span><span>Loading checkout…</span></Row>}
          {status === 'error' && <Badge tone="bad">We could not load your checkout. Please try again.</Badge>}
          {status === 'ready' && view && (
            <Stack gap={6}>
              <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>Traveller: {view.name}</span>
              {view.items.map((i) => <span key={i}>{i}</span>)}
              <span style={{ fontSize: 13 }}>Pay with: {view.methods}</span>
              <strong style={{ fontSize: 20, color: view.total.includes('undefined') ? 'var(--bad)' : 'var(--ink)' }}>Total: {view.total}</strong>
              <Row><Button tone="primary">Pay</Button></Row>
            </Stack>
          )}
        </Stack>
      </Browser>
      <Row gap={10}>
        <Button tone="primary" onClick={load}>Load checkout</Button>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={paymentsDown} onChange={(e) => setPaymentsDown(e.target.checked)} />
          Payments API down (500)
        </label>
      </Row>
      <Row gap={10}>
        <Stat label="load time" value={elapsed === null ? '…' : `${(elapsed / 1000).toFixed(1)} s`} tone={elapsed === null ? 'neutral' : slow ? 'bad' : 'good'} />
        <Stat label="spinner" value={status === 'loading' ? 'spinning' : status === 'idle' ? 'off' : 'hidden'} tone={status === 'loading' ? 'warn' : 'neutral'} />
      </Row>
      <Code>{fixed
        ? `const [profile, cart, methods] = await Promise.all([\n  getJSON('/api/profile'), getJSON('/api/cart'), getJSON('/api/payment-methods'),\n]);\nconst quote = await pricing(cart);\n// getJSON throws when !res.ok; try/catch shows an error, finally hides the spinner`
        : `const profile = await fetch('/api/profile').then((r) => r.json());\nconst cart = await fetch('/api/cart').then((r) => r.json());\nconst methods = await fetch('/api/payment-methods').then((r) => r.json());\nconst quote = pricing(cart);\nrender(profile, cart, methods, quote.total);\nhideSpinner();`}</Code>
      <Console lines={c.lines} height={150} title="Network" onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <CheckoutDemo fixed={false} />;
}

export function Solution() {
  return <CheckoutDemo fixed />;
}
