import { memo, useDeferredValue, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Badge, Browser, Button, Code, Input, Note, Row, Stack, Stat } from '../../demo-kit';

export const scenario =
  'A B2B parts catalog filters 8,000 SKUs on the client as the buyer types into the search box, with Grid and Table views.';
export const task = 'Type "brake disc" quickly into the search box, then switch between Grid and Table. Watch the keystroke time.';
export const solutionNote =
  'Same catalog: the list renders from useDeferredValue, tabs switch in startTransition, and the list is memoized.';

const KINDS = ['Brake disc', 'Brake pad', 'Oil filter', 'Air filter', 'Spark plug', 'Wiper blade', 'Timing belt', 'Clutch kit'];
const MAKES = ['Bosch', 'Brembo', 'Valeo', 'NGK', 'Mann', 'TRW', 'Gates', 'Sachs'];
const PRODUCTS = Array.from({ length: 8000 }, (_, i) => ({
  sku: `P-${String(10000 + i)}`,
  name: `${KINDS[i % KINDS.length]} ${MAKES[(i * 7) % MAKES.length]} ${100 + (i % 900)}`,
  price: 9 + ((i * 37) % 240),
}));
const SHOWN = 160; // rows rendered
const ROW_COST_MS = 0.7; // simulated per-row render cost (bounded: ~110ms max per list render)

function burn(ms: number) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    /* simulated expensive row render */
  }
}

type Item = (typeof PRODUCTS)[number];

function ProductRow({ item, view }: { item: Item; view: 'grid' | 'table' }) {
  burn(ROW_COST_MS); // each row is "expensive" (images, formatting, badges...)
  return view === 'grid' ? (
    <div style={{ padding: 6, border: '1px solid var(--line)', borderRadius: 8, fontSize: 11, background: 'var(--paper)' }}>
      <strong>{item.name}</strong>
      <div style={{ color: 'var(--ink-3)' }}>
        {item.sku} · €{item.price}
      </div>
    </div>
  ) : (
    <div style={{ display: 'flex', gap: 8, fontSize: 11, padding: '3px 0', borderBottom: '1px solid var(--line)' }}>
      <code style={{ flex: 'none' }}>{item.sku}</code>
      <span style={{ flex: 1 }}>{item.name}</span>
      <span>€{item.price}</span>
    </div>
  );
}

function ProductList({ items, view }: { items: Item[]; view: 'grid' | 'table' }) {
  return (
    <div style={view === 'grid' ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 } : {}}>
      {items.slice(0, SHOWN).map((item) => (
        <ProductRow key={item.sku} item={item} view={view} />
      ))}
    </div>
  );
}
const MemoList = memo(ProductList);

function filter(q: string) {
  const s = q.trim().toLowerCase();
  return s ? PRODUCTS.filter((p) => p.name.toLowerCase().includes(s)) : PRODUCTS;
}

function Catalog({ fixed }: { fixed: boolean }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);
  const listQuery = fixed ? deferredQuery : query;
  const results = useMemo(() => filter(listQuery), [listQuery]);
  const isStale = fixed && query !== deferredQuery;

  // measure: keystroke event → the commit that shows the new character
  const typedAt = useRef(0);
  const [lag, setLag] = useState<number[]>([]);
  useLayoutEffect(() => {
    if (!typedAt.current) return;
    const ms = performance.now() - typedAt.current;
    typedAt.current = 0;
    setLag((l) => [...l, ms].slice(-12));
  }, [query]);

  const last = lag[lag.length - 1];
  const worst = lag.length ? Math.max(...lag) : 0;
  const tone = (ms: number | undefined) => (ms === undefined ? 'neutral' : ms > 50 ? 'bad' : 'good');

  const switchView = (v: 'grid' | 'table') => (fixed ? startTransition(() => setView(v)) : setView(v));

  return (
    <Stack gap={12}>
      <Browser url="parts.example-b2b.com/catalog">
        <Stack gap={10}>
          <Input
            value={query}
            placeholder="Search parts (e.g. brake disc)"
            aria-label="Search parts"
            onChange={(e) => {
              typedAt.current = performance.now();
              setQuery(e.target.value);
            }}
          />
          <Row gap={6}>
            <Button tone={view === 'grid' ? 'primary' : 'default'} onClick={() => switchView('grid')}>
              Grid
            </Button>
            <Button tone={view === 'table' ? 'primary' : 'default'} onClick={() => switchView('table')}>
              Table
            </Button>
            <Badge>{results.length.toLocaleString()} parts</Badge>
            {(isPending || isStale) && <Badge tone="info">updating…</Badge>}
          </Row>
          <div style={{ maxHeight: 220, overflow: 'auto', opacity: isPending || isStale ? 0.55 : 1, transition: 'opacity 200ms ease' }}>
            {fixed ? <MemoList items={results} view={view} /> : <ProductList items={results} view={view} />}
          </div>
        </Stack>
      </Browser>

      <Row gap={8}>
        <Stat label="last keystroke → screen (ms)" value={last === undefined ? '—' : last.toFixed(0)} tone={tone(last)} />
        <Stat label="worst keystroke (ms)" value={lag.length ? worst.toFixed(0) : '—'} tone={tone(lag.length ? worst : undefined)} />
        <Button tone="ghost" onClick={() => setLag([])}>
          Clear timings
        </Button>
      </Row>
      <Note>
        Each row costs ~{ROW_COST_MS}ms to render; {SHOWN} rows are shown.
      </Note>

      <Code>
        {fixed
          ? `const deferredQuery = useDeferredValue(query);\nconst results = useMemo(() => filter(deferredQuery), [deferredQuery]);\n<input value={query} onChange={e => setQuery(e.target.value)} />\n<MemoList items={results} />   // re-renders in the background\nonClick={() => startTransition(() => setView('table'))}`
          : `const results = filter(query); // same render as the keystroke\n<input value={query} onChange={e => setQuery(e.target.value)} />\n<ProductList items={results} />  // 160 slow rows, blocking\nonClick={() => setView('table')}`}
      </Code>
    </Stack>
  );
}

export function Problem() {
  return <Catalog fixed={false} />;
}

export function Solution() {
  return <Catalog fixed />;
}
