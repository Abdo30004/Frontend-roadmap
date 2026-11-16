import { useEffect, useId, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Note, Row, Stack, Stat } from '../../demo-kit';

export const scenario = 'An online pharmacy has a product search box above its catalog. Customers type what they need, often on a phone keyboard.';
export const task = 'Type (or tap) "IBUPROFEN", then "vitamin " with a trailing space, then "zzz". Watch the results each time.';
export const solutionNote = 'Same catalog: only the query is state, the list is derived, case-insensitive and trimmed, with a label and empty state.';

interface Product { id: number; name: string }
const PRODUCTS: Product[] = [
  { id: 1, name: 'Ibuprofen 400mg' },
  { id: 2, name: 'Vitamin C 1000mg' },
  { id: 3, name: 'Vitamin D3 Drops' },
  { id: 4, name: 'Paracetamol 500mg' },
  { id: 5, name: 'Hand Sanitizer Gel' },
  { id: 6, name: 'Zinc Lozenges' },
];
const TRIES = ['IBUPROFEN', 'vitamin ', 'zzz', ''];

/* ---------- the naive version (as shipped) ---------- */
type Props = { products: Product[]; preset: { v: string; n: number }; onCount: (n: number) => void };

function NaiveSearch({ products, preset, onCount }: Props) {
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState(products);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Extra render on every keystroke, case-sensitive, no trim
    setFiltered(products.filter((p) => p.name.includes(query)));
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // Demo helper: the "Try" chips type into the (uncontrolled) input.
  useEffect(() => {
    if (preset.n === 0 || !input.current) return;
    input.current.value = preset.v;
    setQuery(preset.v);
  }, [preset]);

  return (
    <div>
      <input ref={input} className="dk-input" placeholder="Search" onChange={(e) => setQuery(e.target.value)} style={{ width: '100%', maxWidth: 260 }} />
      <ul style={{ margin: '10px 0 0', paddingLeft: 18, minHeight: 24 }}>
        {filtered.map((p, i) => <li key={i}>{p.name}</li>)}
      </ul>
      <Count n={filtered.length} onCount={onCount} />
    </div>
  );
}

/* ---------- the clean solution ---------- */
function ProductSearch({ products, preset, onCount }: Props) {
  const [query, setQuery] = useState('');
  const id = useId();
  useEffect(() => { if (preset.n > 0) setQuery(preset.v); }, [preset]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleProducts = normalizedQuery === ''
    ? products
    : products.filter((p) => p.name.toLowerCase().includes(normalizedQuery));

  return (
    <section>
      <label htmlFor={id} style={{ display: 'block', fontSize: 13, color: 'var(--ink-2)', marginBottom: 4 }}>Search products</label>
      <input id={id} className="dk-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g. vitamin" autoComplete="off" style={{ width: '100%', maxWidth: 260 }} />
      <p aria-live="polite" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>{visibleProducts.length} products found</p>
      {visibleProducts.length === 0 ? (
        <p style={{ margin: '6px 0 0', fontSize: 14 }}>No products match "{query.trim()}". Try a shorter word.</p>
      ) : (
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {visibleProducts.map((p) => <li key={p.id}>{p.name}</li>)}
        </ul>
      )}
      <Count n={visibleProducts.length} onCount={onCount} />
    </section>
  );
}

/** Reports the result count up to the shell so it can show a Stat. */
function Count({ n, onCount }: { n: number; onCount: (n: number) => void }) {
  useEffect(() => { onCount(n); }, [n, onCount]);
  return null;
}

function Shell({ fixed }: { fixed: boolean }) {
  const [preset, setPreset] = useState({ v: '', n: 0 });
  const [count, setCount] = useState(PRODUCTS.length);
  const [last, setLast] = useState<string | null>(null);

  const expected = (q: string) => PRODUCTS.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())).length;

  return (
    <Stack gap={14}>
      <Browser url="pharmacy.example/shop">
        {fixed ? <ProductSearch products={PRODUCTS} preset={preset} onCount={setCount} /> : <NaiveSearch products={PRODUCTS} preset={preset} onCount={setCount} />}
      </Browser>
      <Row gap={6}>
        <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Try:</span>
        {TRIES.map((t) => (
          <Button key={t} tone="ghost" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
            onClick={() => { setPreset((p) => ({ v: t, n: p.n + 1 })); setLast(t); }}>
            {t === '' ? '(clear)' : JSON.stringify(t)}
          </Button>
        ))}
      </Row>
      <Row gap={8}>
        <Stat label="results shown" value={count} tone={count === 0 ? (fixed ? 'warn' : 'bad') : 'neutral'} />
        {last !== null && <Stat label={`should match ${JSON.stringify(last)}`} value={expected(last)} tone={expected(last) === count ? 'good' : 'bad'} />}
        {!fixed && count === 0 && <Badge tone="bad">Blank area: looks like the page is broken</Badge>}
      </Row>
      {!fixed && <Note>Screen-reader users focusing the box hear only "edit text".</Note>}
      <Code>{fixed
        ? `const normalizedQuery = query.trim().toLowerCase();\nconst visibleProducts = normalizedQuery === ""\n  ? products\n  : products.filter((p) => p.name.toLowerCase().includes(normalizedQuery));`
        : `const [filtered, setFiltered] = useState(products);\nuseEffect(() => {\n  setFiltered(products.filter((p) => p.name.includes(query)));\n}, [query]);`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <Shell fixed={false} />;
}

export function Solution() {
  return <Shell fixed />;
}
