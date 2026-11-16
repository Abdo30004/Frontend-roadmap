import { useEffect, useReducer, useState } from 'react';
import { Badge, Browser, Button, Code, Note, Panel, Resettable, Row, Stack, Stat, fakeRequest, type Tone } from '../../demo-kit';

export const scenario =
  'A logistics back-office: dispatchers see an Orders list next to the selected order, and mark orders as shipped.';
export const task = 'Open ORD-1002, press "Mark shipped", then compare the list with the server. Try "Colleague ships ORD-1004" and "Refocus tab" too.';
export const solutionNote = 'Same screens, but both panels read one query cache; the mutation invalidates ["orders"] so every view refetches.';

type Status = 'Pending' | 'Shipped';
interface Order { id: string; customer: string; status: Status }

/* ---------- fake backend (the single source of truth) ---------- */
function createServer() {
  let rows: Order[] = [
    { id: 'ORD-1001', customer: 'Nordic Foods', status: 'Shipped' },
    { id: 'ORD-1002', customer: 'Acme Tools', status: 'Pending' },
    { id: 'ORD-1003', customer: 'Blue Harbor', status: 'Pending' },
    { id: 'ORD-1004', customer: 'Kite & Co', status: 'Pending' },
  ];
  const subs = new Set<() => void>();
  const set = (id: string) => { rows = rows.map((o) => (o.id === id ? { ...o, status: 'Shipped' } : o)); subs.forEach((f) => f()); };
  return {
    peek: () => rows,
    onChange: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
    list: () => fakeRequest(() => rows.map((o) => ({ ...o })), { delay: [300, 500] }),
    get: (id: string) => fakeRequest(() => ({ ...rows.find((o) => o.id === id)! }), { delay: [250, 400] }),
    ship: async (id: string) => { await fakeRequest(null, { delay: 350 }); set(id); return { ...rows.find((o) => o.id === id)! }; },
    colleagueShip: set,
  };
}
type Server = ReturnType<typeof createServer>;

/* ---------- a tiny query cache (what TanStack Query does for you) ---------- */
function createQueryClient() {
  const data = new Map<string, unknown>();
  const fetching = new Set<string>();
  const fns = new Map<string, () => Promise<unknown>>();
  const subs = new Set<() => void>();
  const notify = () => subs.forEach((f) => f());
  const fetchKey = async (key: string) => {
    const fn = fns.get(key);
    if (!fn || fetching.has(key)) return;                  // dedup in-flight requests
    fetching.add(key); notify();
    const value = await fn();
    fetching.delete(key); data.set(key, value); notify();
  };
  return {
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
    read: (key: string) => ({ data: data.get(key), fetching: fetching.has(key) }),
    ensure: (key: string, fn: () => Promise<unknown>) => { fns.set(key, fn); if (!data.has(key)) void fetchKey(key); },
    setData: (key: string, value: unknown) => { data.set(key, value); notify(); },
    invalidate: (prefix: string) => { for (const key of fns.keys()) if (key.startsWith(prefix)) void fetchKey(key); },
  };
}
type QueryClient = ReturnType<typeof createQueryClient>;

function useQuery<T>(qc: QueryClient, key: string | null, fn: () => Promise<T>) {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  useEffect(() => qc.subscribe(rerender), [qc]);
  useEffect(() => { if (key) qc.ensure(key, fn); }, [qc, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const r = key ? qc.read(key) : { data: undefined, fetching: false };
  return { data: r.data as T | undefined, fetching: r.fetching };
}

/* ---------- the two data layers, same interface ---------- */
interface Layer { list?: Order[]; listLoading: boolean; detail?: Order; ship: (id: string) => Promise<void>; refocus: () => void }

// BUG: server data copied once into a global store; detail keeps its own copy
function useStoreLayer(server: Server, selected: string | null): Layer {
  const [store, setStore] = useState<{ items: Order[]; loading: boolean }>({ items: [], loading: false });
  const [detail, setDetail] = useState<Order>();
  useEffect(() => {
    if (store.items.length === 0) {                       // "cache": never refetches once filled
      setStore((s) => ({ ...s, loading: true }));
      void server.list().then((items) => setStore({ items, loading: false }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selected) void server.get(selected).then(setDetail); }, [server, selected]);
  return {
    list: store.items.length ? store.items : undefined,
    listLoading: store.loading,
    detail: detail?.id === selected ? detail : undefined,
    ship: async (id) => { setDetail(await server.ship(id)); },   // the list never learns about it
    refocus: () => {},                                           // nothing listens to focus
  };
}

// FIX: one cache keyed by query; mutations invalidate by prefix
function useQueryLayer(server: Server, selected: string | null): Layer {
  const [qc] = useState(createQueryClient);
  const list = useQuery(qc, 'orders/list', server.list);
  const detail = useQuery(qc, selected ? `orders/detail/${selected}` : null, () => server.get(selected!));
  return {
    list: list.data,
    listLoading: list.fetching,
    detail: detail.data,
    ship: async (id) => {
      const updated = await server.ship(id);
      qc.setData(`orders/detail/${id}`, updated);
      qc.invalidate('orders/');                            // every list variant refetches
    },
    refocus: () => qc.invalidate('orders/'),               // refetchOnWindowFocus
  };
}

function OrdersApp({ useLayer, fixed, reset }: { useLayer: typeof useStoreLayer; fixed: boolean; reset: () => void }) {
  const [server] = useState(createServer);
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  useEffect(() => server.onChange(rerender), [server]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const layer = useLayer(server, selected);

  const truth = server.peek();
  const outOfSync = layer.list ? layer.list.filter((o) => truth.find((t) => t.id === o.id)?.status !== o.status).length : 0;
  const tone = (s: Status): Tone => (s === 'Shipped' ? 'good' : 'warn');

  return (
    <Stack gap={12}>
      <Browser url="backoffice.example-logistics.com/orders">
        <Row gap={10} align="stretch">
          <Panel title={<>Orders list {layer.listLoading && <Badge tone="info">fetching…</Badge>}</>} style={{ flex: '1 1 180px' }}>
            {!layer.list ? <Note>Loading…</Note> : (
              <Stack gap={4}>
                {layer.list.map((o) => (
                  <Row key={o.id} gap={6} wrap={false}>
                    <Button tone={selected === o.id ? 'primary' : 'ghost'} onClick={() => setSelected(o.id)} style={{ padding: '2px 8px' }}>{o.id}</Button>
                    <Badge tone={tone(o.status)}>{o.status}</Badge>
                  </Row>
                ))}
              </Stack>
            )}
          </Panel>
          <Panel title="Order detail" style={{ flex: '1 1 150px' }}>
            {!selected ? <Note>Pick an order.</Note> : !layer.detail ? <Note>Loading…</Note> : (
              <Stack gap={6}>
                <strong>{layer.detail.id}</strong>
                <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{layer.detail.customer}</span>
                <Badge tone={tone(layer.detail.status)}>{layer.detail.status}</Badge>
                <Button
                  tone="primary"
                  disabled={busy || layer.detail.status === 'Shipped'}
                  onClick={async () => { setBusy(true); await layer.ship(layer.detail!.id); setBusy(false); }}
                >{busy ? 'Saving…' : 'Mark shipped'}</Button>
              </Stack>
            )}
          </Panel>
        </Row>
      </Browser>

      <Row gap={6}>
        <Button onClick={() => server.colleagueShip('ORD-1004')}>Colleague ships ORD-1004</Button>
        <Button onClick={layer.refocus}>Refocus tab</Button>
        <Button tone="ghost" onClick={reset}>Reset</Button>
      </Row>

      <Row gap={8}>
        <Stat label="list rows out of sync with server" value={outOfSync} tone={outOfSync ? 'bad' : 'good'} />
        <Panel title="Server database (truth)" style={{ flex: '1 1 200px' }}>
          <Row gap={4}>{truth.map((o) => <Badge key={o.id} tone={tone(o.status)}>{o.id.slice(4)} {o.status}</Badge>)}</Row>
        </Panel>
      </Row>

      <Code>{fixed
        ? `const list = useQuery(['orders','list'], fetchOrders);\nonSuccess: (o) => {\n  qc.setQueryData(['orders','detail',o.id], o);\n  qc.invalidateQueries({ queryKey: ['orders'] });\n}`
        : `useEffect(() => {\n  if (items.length === 0) fetchOrders().then(d => dispatch(setOrders(d)));\n}, []);\nconst ship = (id) => api.post(\`/orders/\${id}/ship\`); // list never told`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <Resettable>{(reset) => <OrdersApp useLayer={useStoreLayer} fixed={false} reset={reset} />}</Resettable>;
}

export function Solution() {
  return <Resettable>{(reset) => <OrdersApp useLayer={useQueryLayer} fixed reset={reset} />}</Resettable>;
}
