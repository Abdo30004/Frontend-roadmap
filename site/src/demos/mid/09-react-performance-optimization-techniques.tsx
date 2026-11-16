import { memo, useDeferredValue, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Input, Note, Row, Stack, Stat } from '../../demo-kit';

export const scenario = 'A real-estate search page lists 300 homes and has a "City" filter at the top that narrows the list as you type.';
export const task = 'Type "lisbon" quickly in the City box, then delete it. Watch how the letters appear and the "keystroke → screen" time.';
export const solutionNote = 'Same list and same cost per card: the filter is useMemo\'d and the list renders from useDeferredValue(city).';

const CITIES = ['Lisbon', 'London', 'Lyon', 'Leipzig', 'Porto', 'Paris', 'Prague', 'Madrid', 'Milan', 'Munich', 'Berlin', 'Barcelona'];
const STREETS = ['Rua Augusta', 'High St', 'Rue Mercière', 'Main St', 'Via Roma', 'Calle Mayor'];
interface Listing { id: number; city: string; street: string; price: number; beds: number }
const LISTINGS: Listing[] = Array.from({ length: 300 }, (_, i) => ({
  id: i + 1,
  city: CITIES[(i * 7) % CITIES.length],
  street: `${(i * 13) % 180 + 1} ${STREETS[i % STREETS.length]}`,
  price: 180_000 + ((i * 7919) % 900) * 1000,
  beds: (i % 4) + 1,
}));

/** Each card is "expensive" (images, formatting, map pin): ~0.4ms of real CPU work. 300 cards ≈ 120ms. */
function ListingCard({ listing }: { listing: Listing }) {
  const end = performance.now() + 0.4;
  while (performance.now() < end) { /* layout math, formatting… */ }
  return (
    <Row gap={8} wrap={false} style={{ padding: '6px 0', borderTop: '1px solid var(--line)', fontSize: 13 }}>
      <span aria-hidden>🏠</span>
      <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.street}, {listing.city}</span>
      <strong style={{ fontFamily: 'var(--font-mono)' }}>€{Math.round(listing.price / 1000)}k</strong>
    </Row>
  );
}

function ListingList({ city }: { city: string }) {
  const q = city.trim().toLowerCase();
  const filtered = LISTINGS.filter((l) => l.city.toLowerCase().includes(q));
  return (
    <Stack gap={0}>
      <Note>{filtered.length} homes</Note>
      {filtered.map((l) => <ListingCard key={l.id} listing={l} />)}
    </Stack>
  );
}

/** Fixed version: memoized list + memoized filter. Only re-renders when the (deferred) city changes. */
const MemoListingList = memo(function MemoListingList({ city }: { city: string }) {
  const filtered = useMemo(() => {
    const q = city.trim().toLowerCase();
    return LISTINGS.filter((l) => l.city.toLowerCase().includes(q));
  }, [city]);
  return (
    <Stack gap={0}>
      <Note>{filtered.length} homes</Note>
      {filtered.map((l) => <ListingCard key={l.id} listing={l} />)}
    </Stack>
  );
});

function SearchPage({ fixed }: { fixed: boolean }) {
  const [city, setCity] = useState('');
  // Fixed version only (the buggy page doesn't use it): input updates first, the list follows.
  const deferredCity = useDeferredValue(fixed ? city : '');
  const t0 = useRef(0);
  const lastEl = useRef<HTMLSpanElement>(null);
  const worstEl = useRef<HTMLSpanElement>(null);
  const worst = useRef(0);

  // Measure "keystroke → input committed" without causing extra renders (writes straight to the DOM).
  useLayoutEffect(() => {
    if (!t0.current) return;
    const ms = Math.round(performance.now() - t0.current);
    t0.current = 0;
    worst.current = Math.max(worst.current, ms);
    for (const [el, v] of [[lastEl.current, ms], [worstEl.current, worst.current]] as const) {
      if (!el) continue;
      el.textContent = String(v);
      el.style.color = v > 50 ? 'var(--bad)' : 'var(--good)';
    }
  }, [city]);

  const reset = () => {
    worst.current = 0;
    for (const el of [lastEl.current, worstEl.current]) if (el) { el.textContent = '–'; el.style.color = ''; }
    setCity('');
  };

  const stale = fixed && city !== deferredCity;
  return (
    <Stack gap={12}>
      <Browser url="homefinder.example/search">
        <Stack gap={10}>
          <Row gap={8}>
            <Input value={city} placeholder="City (try: lisbon)" aria-label="City"
              onChange={(e) => { t0.current = performance.now(); setCity(e.target.value); }} style={{ flex: '1 1 160px' }} />
            {stale && <Badge tone="info">updating list…</Badge>}
          </Row>
          <div style={{ height: 220, overflowY: 'auto', opacity: stale ? 0.6 : 1, transition: 'opacity 200ms ease' }}>
            {fixed ? <MemoListingList city={deferredCity} /> : <ListingList city={city} />}
          </div>
        </Stack>
      </Browser>
      <Row gap={8}>
        <Stat label="last keystroke → input on screen (ms)" value={<span ref={lastEl}>–</span>} />
        <Stat label="worst (ms)" value={<span ref={worstEl}>–</span>} />
        <Button tone="ghost" onClick={reset}>Reset</Button>
      </Row>
      <Note>Over ~50ms per keystroke feels laggy (INP). The cost per card is the same in both versions.</Note>
      <Code>{fixed
        ? `const deferredCity = useDeferredValue(city);\n<input value={city} onChange={(e) => setCity(e.target.value)} />\n<MemoListingList city={deferredCity} /> // memo + useMemo(filter)`
        : `const [city, setCity] = useState('');\n<input value={city} onChange={(e) => setCity(e.target.value)} />\n<ListingList city={city} /> // 300 cards on every keystroke`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <SearchPage fixed={false} />;
}

export function Solution() {
  return <SearchPage fixed />;
}
