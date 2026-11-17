import { Component, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Badge, Browser, Button, Code, Console, Row, Stack, Stat, fakeRequest, useConsole } from '../../demo-kit';

export const scenario = 'A take-home "product catalog" app that loads products from a shop API and shows them in a grid.';
export const task = 'Press "Reload app" once normally, then tick "Make the API fail" and reload again. Watch the screen and the console.';
export const solutionNote =
  'Same API: an API client that checks res.ok, a hook with loading / error / empty / success, and a retry button.';

interface Product {
  id: number;
  title: string;
  price: number;
  emoji: string;
}
const DATA: Product[] = [
  { id: 1, title: 'Canvas backpack', price: 49.9, emoji: '🎒' },
  { id: 2, title: 'Steel water bottle', price: 19.5, emoji: '🧴' },
  { id: 3, title: 'Desk lamp', price: 34.0, emoji: '💡' },
  { id: 4, title: 'Wool beanie', price: 15.0, emoji: '🧢' },
];

interface ApiSettings {
  fail: boolean;
  empty: boolean;
}
/** Simulated fetch(): resolves to a Response-like object, like the real fetch does even on a 500. */
function fakeFetch(s: ApiSettings, signal?: AbortSignal) {
  return fakeRequest(
    () =>
      s.fail
        ? { ok: false, status: 503, json: async () => ({ error: 'Service unavailable' }) as unknown }
        : { ok: true, status: 200, json: async () => (s.empty ? [] : DATA) as unknown },
    { delay: 1100, signal },
  );
}

/* ---------- the take-home as submitted ---------- */
function ProductsPageNaive({ api }: { api: ApiSettings }) {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    fakeFetch(api)
      .then((r) => r.json())
      .then((data) => setProducts(data as Product[])); // no res.ok check, no error handling
  }, [api]);

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', width: 640 }}>
        {products.map((p) => (
          <div key={p.id} style={{ width: 150, flex: 'none', marginRight: 10 }}>
            <div style={{ fontSize: 40 }}>{p.emoji}</div>
            <b style={{ fontSize: 13 }}>{p.title}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- the fix: API client + data hook + every UI state ---------- */
async function apiGet(api: ApiSettings, signal: AbortSignal): Promise<Product[]> {
  const res = await fakeFetch(api, signal);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as Product[];
}

type Query = { status: 'pending' } | { status: 'error'; message: string } | { status: 'success'; data: Product[] };
function useProducts(api: ApiSettings) {
  const [state, setState] = useState<Query>({ status: 'pending' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'pending' });
    apiGet(api, ctrl.signal)
      .then((data) => setState({ status: 'success', data }))
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setState({ status: 'error', message: e.message });
      });
    return () => ctrl.abort();
  }, [api, attempt]);
  const refetch = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, refetch };
}

function ProductList({ api }: { api: ApiSettings }) {
  const q = useProducts(api);
  if (q.status === 'pending') {
    return (
      <div
        role="status"
        aria-label="Loading products"
        style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 8rem), 1fr))' }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ height: 86, borderRadius: 8, background: 'var(--paper-2)' }} />
        ))}
      </div>
    );
  }
  if (q.status === 'error') {
    return (
      <Stack gap={8}>
        <div role="alert" style={{ color: 'var(--bad)', fontSize: 14 }}>
          ⚠ Could not load products ({q.message}).
        </div>
        <Row>
          <Button tone="primary" onClick={q.refetch}>
            Try again
          </Button>
        </Row>
      </Stack>
    );
  }
  if (q.data.length === 0) return <p style={{ margin: 0, color: 'var(--ink-3)' }}>No products yet.</p>;
  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'grid',
        gap: 10,
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 8rem), 1fr))',
      }}
    >
      {q.data.map((p) => (
        <li key={p.id}>
          <a
            href={`#product-${p.id}`}
            onClick={(e) => e.preventDefault()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: 8,
              borderRadius: 8,
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              textDecoration: 'none',
            }}
          >
            <span style={{ fontSize: 32 }} aria-hidden>
              {p.emoji}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{p.price.toFixed(2)} EUR</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/* ---------- shell: a crash = blank page, like an app with no error boundary ---------- */
class CrashToBlank extends Component<{ children: ReactNode; onCrash: (m: string) => void }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(e: Error) {
    this.props.onCrash(e.message);
  }
  render() {
    return this.state.crashed ? (
      <div style={{ minHeight: 90, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontSize: 13 }}>(blank white page)</div>
    ) : (
      this.props.children
    );
  }
}

function CatalogApp({ fixed }: { fixed: boolean }) {
  const [fail, setFail] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [boot, setBoot] = useState(0);
  const [api, setApi] = useState<ApiSettings>({ fail: false, empty: false });
  const [crashes, setCrashes] = useState(0);
  const log = useConsole();

  const reload = () => {
    setApi({ fail, empty });
    setBoot((b) => b + 1);
    log.log(`GET /products → ${fail ? '503 Service unavailable' : '200 OK'}`, fail ? 'warn' : 'neutral');
  };

  return (
    <Stack gap={14}>
      <Row gap={14}>
        <label style={{ display: 'flex', gap: 6, fontSize: 14 }}>
          <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Make the API fail
        </label>
        <label style={{ display: 'flex', gap: 6, fontSize: 14 }}>
          <input type="checkbox" checked={empty} onChange={(e) => setEmpty(e.target.checked)} /> Return an empty list
        </label>
        <Button tone="primary" onClick={reload}>
          Reload app
        </Button>
      </Row>

      <Browser url="catalog.example">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>🛍️ Catalog</div>
        {boot === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)' }}>Press "Reload app" to open it.</p>
        ) : (
          <CrashToBlank
            key={boot}
            onCrash={(m) => {
              setCrashes((c) => c + 1);
              log.log(`Uncaught TypeError: ${m}`, 'bad');
            }}
          >
            {fixed ? <ProductList api={api} /> : <ProductsPageNaive api={api} />}
          </CrashToBlank>
        )}
      </Browser>

      <Row gap={8}>
        <Stat label="app crashes" value={crashes} tone={crashes ? 'bad' : 'neutral'} />
        <Badge tone="info">API latency ≈ 1.1 s</Badge>
      </Row>
      <Console lines={log.lines} height={110} onClear={log.clear} />
      <Code>
        {fixed
          ? `const res = await fetch(url, { signal });\nif (!res.ok) throw new Error(\`Request failed: \${res.status}\`);\n// ...\nif (isPending) return <Skeleton />;\nif (isError) return <ErrorMessage onRetry={refetch} />;\nif (products.length === 0) return <EmptyState />;`
          : `useEffect(() => {\n  fetch("https://api.shop.example/products")\n    .then((r) => r.json())\n    .then((data) => setProducts(data)); // no res.ok, no catch\n}, []);\nreturn <div style={{ display: "flex", width: 640 }}>{products.map(...)}</div>;`}
      </Code>
    </Stack>
  );
}

export function Problem() {
  return <CatalogApp fixed={false} />;
}

export function Solution() {
  return <CatalogApp fixed />;
}
