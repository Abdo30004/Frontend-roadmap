# How do you render and debug very large lists (10,000-50,000+ rows) without lag?

**Level:** Mid
**Merged from (original phrasings):**
- How would you efficiently render a table containing 50,000+ records?
- A page renders 10,000 items and starts lagging. What do you do?
- A 5,000-row list is janky. How do you find the cause before touching code?

## The concept (short answer)
- **Measure first.** Record in the Chrome DevTools Performance tab (look for long tasks, "Recalculate Style"/"Layout" blocks, and scripting time) and in the React DevTools Profiler (which components re-render, how often, and why: enable "Record why each component rendered"). The cause might be DOM size, re-render storms, expensive per-row work, or layout thrashing, and each has a different fix.
- **The main cause is DOM size.** 50,000 rows x 8 cells is 400,000 DOM nodes. Style, layout and paint all scale with node count, and React has to reconcile every row whenever the parent re-renders.
- **Virtualization (windowing)** renders only the rows in the viewport plus a small overscan (around 30 rows), and uses a spacer with the full height so the scrollbar still looks right. Libraries: TanStack Virtual (`@tanstack/react-virtual`), react-window.
- **Don't send all the data to the browser.** Use server-side pagination or infinite loading, and server-side filtering and sorting. 50k rows of JSON is also a network and memory cost.
- **Cut re-render cost:** use `React.memo` rows with stable props (`useCallback` handlers, ids instead of new objects), keep selection state out of the parent where possible, and use `useDeferredValue` or debouncing for filter inputs.
- **CSS help:** `content-visibility: auto` lets the browser skip rendering off-screen content when you cannot virtualize.

## Real-life example: the problem
In a logistics admin panel, the "Shipments" page loads 20,000 shipments into a table with a search box. Users report that typing in the search box freezes the page for about 2 seconds per keystroke, and scrolling stutters. The Performance tab shows 1.8 s long tasks per keystroke. The React Profiler shows that every `ShipmentRow` re-renders on each keystroke, because `onSelect` is a new function and `filtered` is recomputed every render.

```jsx
function ShipmentsPage({ shipments }) { // 20,000 items
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const filtered = shipments.filter(s =>
    s.customer.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <table>
        <tbody>
          {filtered.map(s => (
            <ShipmentRow
              key={s.id}
              shipment={s}
              selected={s.id === selectedId}
              onSelect={() => setSelectedId(s.id)} // new fn per row per render
            />
          ))}
        </tbody>
      </table>
    </>
  );
}
```

Problems: 20,000 `<tr>` elements in the DOM, all of them reconciled on every keystroke, filtering on the hot path of typing, and no memoization.

## How to fix it
```jsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';

const ROW_HEIGHT = 40;

const ShipmentRow = memo(function ShipmentRow({ shipment, selected, onSelect, style }) {
  return (
    <div role="row" style={style} className={selected ? 'row selected' : 'row'}
         onClick={() => onSelect(shipment.id)}>
      <span role="cell">{shipment.trackingNo}</span>
      <span role="cell">{shipment.customer}</span>
      <span role="cell">{shipment.status}</span>
    </div>
  );
});

function ShipmentsPage({ shipments }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query); // typing stays responsive
  const [selectedId, setSelectedId] = useState(null);
  const onSelect = useCallback(id => setSelectedId(id), []); // stable reference

  const filtered = useMemo(() => {
    const q = deferredQuery.toLowerCase();
    return shipments.filter(s => s.customerLower.includes(q)); // pre-lowercased once
  }, [shipments, deferredQuery]);

  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search customer" />
      <div ref={parentRef} role="table" style={{ height: 600, overflow: 'auto' }}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(v => {
            const s = filtered[v.index];
            return (
              <ShipmentRow
                key={s.id}
                shipment={s}
                selected={s.id === selectedId}
                onSelect={onSelect}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%',
                         height: v.size, transform: `translateY(${v.start}px)` }}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
```

Why it works:
- Only about 25 rows are in the DOM at any time instead of 20,000, so layout and paint cost stay constant however much data there is.
- `memo` and a stable `onSelect` mean that changing the selection re-renders only the two affected rows.
- `useDeferredValue` lets the input update immediately while the filtering and list rendering happen at lower priority.
- Next step for 50k+ rows: move filtering and sorting to the API (`GET /shipments?q=acme&page=3&sort=eta`) and use paginated or infinite queries, so the browser never holds the full dataset.

Alternatives: react-window (`FixedSizeList`) for simpler cases; AG Grid or TanStack Table plus a virtualizer for full data grids; plain pagination when users don't need to scroll continuously. Pagination is often the better UX for admin tables anyway.

## How to say it in the interview
- "Before changing code I profile: the Performance tab tells me whether the time goes to scripting or to layout and paint, and the React Profiler tells me which components re-render and why. Then I pick the fix that matches the cause."
- "For tens of thousands of rows, virtualization keeps the DOM at a constant size. For really large datasets I also push pagination, filtering and sorting to the server."
- Trap: virtualization breaks Ctrl+F (browser find), complicates accessibility (use `aria-rowcount`/`aria-rowindex`), and needs extra work for variable row heights (`measureElement` in TanStack Virtual).
- Trade-off: `React.memo` everywhere is not free. Memoize the rows, which are the hot path, and fix unstable props, otherwise memo has no effect.
