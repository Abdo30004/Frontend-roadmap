# React 18 Concurrent Features and Their Impact on Architecture

**Level:** Senior
**Merged from (original phrasings):**
- Explain React 18's Concurrent Features and how they impact application architecture.

## The concept (short answer)

Concurrent rendering means React can **prepare a new UI in the background, interrupt it, and throw it away** if something more urgent happens. It is opt-in per update via these features:

- **Automatic batching:** multiple `setState` calls in the same tick produce one render - now also inside promises, `setTimeout` and native event handlers (before 18 only React event handlers batched). `flushSync` opts out.
- **`useTransition` / `startTransition`:** marks an update as non-urgent. Urgent updates (typing, clicking) interrupt it; `isPending` lets you show feedback while the old UI stays interactive.
- **`useDeferredValue`:** the "I don't own the setter" version - React first re-renders with the old value, then renders the deferred value in the background.
- **Suspense + streaming SSR:** the server sends the HTML shell immediately and streams each `<Suspense>` boundary's HTML when its data resolves (`renderToPipeableStream`, Next.js App Router does this by default). Slow data no longer blocks the whole page.
- **Selective hydration:** boundaries hydrate independently; if the user clicks a part that is not hydrated yet, React prioritizes hydrating that boundary first.

**Architectural impact:** render functions must be pure and idempotent (they may run several times or be discarded - StrictMode double-invokes to catch this); external mutable stores must use `useSyncExternalStore` to avoid **tearing** (different components showing different versions of the store in one render); you design the page as **Suspense boundaries** (loading states placed by layout, not by each component); and you classify updates as urgent vs transition. Concurrency does not make slow code fast - it keeps input responsive while slow code runs.

## Real-life example: the problem

A B2B parts catalog with 8,000 SKUs filtered client-side. Typing "brake" in the search box feels broken on office laptops: each keystroke freezes the input for ~300ms, letters appear in bursts, and the switching between "Grid" and "Table" tabs blocks the whole page.

```jsx
function Catalog({ products }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');

  // Runs on every keystroke, synchronously, with the same priority as the input itself
  const results = products.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search parts" />
      <button onClick={() => setView('grid')}>Grid</button>
      <button onClick={() => setView('table')}>Table</button>
      {view === 'grid' ? <ProductGrid items={results} /> : <ProductTable items={results} />}
    </>
  );
}
```

The input update and the expensive list render are one synchronous render. React cannot paint the new character until 8,000 rows are diffed, so typing feels laggy and clicks queue up.

## How to fix it

Split the urgent update (the input) from the expensive one (the list), and make the list memoized so the background render can be skipped or interrupted.

```jsx
import { memo, useDeferredValue, useMemo, useState, useTransition } from 'react';

const ProductGrid = memo(function ProductGrid({ items }) { /* ...renders cards... */ });
const ProductTable = memo(function ProductTable({ items }) { /* ...renders rows... */ });

function Catalog({ products }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');
  const [isPending, startTransition] = useTransition();

  const deferredQuery = useDeferredValue(query);   // lags behind during heavy renders
  const isStale = query !== deferredQuery;

  const results = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(deferredQuery.toLowerCase())),
    [products, deferredQuery]
  );

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search parts" />
      <button onClick={() => startTransition(() => setView('grid'))}>Grid</button>
      <button onClick={() => startTransition(() => setView('table'))}>Table</button>
      <div style={{ opacity: isStale || isPending ? 0.6 : 1 }}>
        {view === 'grid' ? <ProductGrid items={results} /> : <ProductTable items={results} />}
      </div>
    </>
  );
}
```

Why it works: the keystroke renders immediately with the *old* `deferredQuery`, so `memo` lets React skip the list and paint the character. Then React renders the list with the new value in the background in ~5ms slices; if another key arrives, that background render is abandoned and restarted. Tab switches are transitions, so the current view stays interactive while the new one renders. If 8,000 rows is still too slow per render, the real fix is virtualization (`@tanstack/react-virtual`) or server-side filtering - concurrency hides latency, it does not remove work.

Streaming + selective hydration on the product page (App Router):

```jsx
export default async function ProductPage({ params }) {
  const { sku } = await params;
  const product = await getProduct(sku);            // fast, critical: in the shell
  return (
    <>
      <ProductHeader product={product} />
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews sku={sku} />                       {/* slow service: streamed later, hydrated on its own */}
      </Suspense>
    </>
  );
}
```

## How to say it in the interview

- "Concurrent React lets rendering be interruptible and prioritized. I mark expensive, non-urgent updates as transitions or deferred values so input always wins, and I design pages as Suspense boundaries so slow data streams in instead of blocking."
- Trap: `useTransition` cannot wrap a controlled input's own state - the input must update urgently; defer the consumer instead. And transitions do not debounce network requests; use `AbortController`/a query library for that.
- Follow-up: "What is tearing?" - a concurrent render reading a mutable external store that changes mid-render; solved by `useSyncExternalStore` (Redux, Zustand and TanStack Query already use it).
- Trade-off: concurrency costs extra render work (renders can be thrown away) and makes timing less predictable; it shines for CPU-heavy UIs, not for I/O-bound slowness.
