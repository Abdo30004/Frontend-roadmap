# Coding challenge: build a Product Search component in React

**Level:** Junior
**Merged from (original phrasings):**
- Build a Product Search Component using React. Requirements: Display a list of products. Provide an input field to search products. Show matching product names based on the search keyword. Display all products when the search field is empty. Handle case-insensitive searching.

## The concept (short answer)
- This tests core React skills: **controlled inputs**, **state**, **derived data**, **list rendering with keys**, and clean conditional rendering.
- The key idea: store only the **search query** in state. The filtered list is **derived** from `products` + `query` during render. Do **not** copy the filtered list into a second `useState` and sync it with `useEffect`; that is extra renders and a source of bugs.
- Case-insensitive: normalize both sides with `.toLowerCase()` (or `toLocaleLowerCase()`), and `.trim()` the query so "  shoe " still matches.
- Empty query: `"".includes` matches everything, but it is clearer to return the full list explicitly.
- Production polish an interviewer likes to hear: an empty-state message, an accessible label, a result count announced to screen readers, `useMemo` for expensive filtering, and `useDeferredValue` so typing stays smooth with huge lists.

## Real-life example: the problem
A typical case: an online pharmacy shipped a naive search box. Users reported:
- Typing "Vitamin " (with a trailing space, common on mobile keyboards with autocomplete) showed no results.
- Searching "IBUPROFEN" found nothing because the data said "Ibuprofen".
- A search with no matches showed a blank area, so users thought the page was broken.
- With 20,000 products, each keystroke froze the input for ~150 ms on low-end phones.
- Screen reader users heard just "edit text" with no label.

```jsx
// Naive version
function ProductSearch({ products }) {
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState(products);

  useEffect(() => {
    // Extra render on every keystroke, case-sensitive, no trim
    setFiltered(products.filter((p) => p.name.includes(query)));
  }, [query]);                                   // missing `products` dependency: stale list

  return (
    <div>
      <input placeholder="Search" onChange={(e) => setQuery(e.target.value)} />
      <ul>
        {filtered.map((p, i) => <li key={i}>{p.name}</li>)}  {/* index as key */}
      </ul>
    </div>
  );
}
```

## How to fix it
Clean solution that meets every requirement (this is what to write first in the interview):

```jsx
import { useState } from "react";

const PRODUCTS = [
  { id: 1, name: "Ibuprofen 400mg" },
  { id: 2, name: "Vitamin C 1000mg" },
  { id: 3, name: "Vitamin D3 Drops" },
  { id: 4, name: "Paracetamol 500mg" },
  { id: 5, name: "Hand Sanitizer Gel" },
];

export default function ProductSearch({ products = PRODUCTS }) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const visibleProducts = normalizedQuery === ""
    ? products
    : products.filter((p) => p.name.toLowerCase().includes(normalizedQuery));

  return (
    <section>
      <label htmlFor="product-search">Search products</label>
      <input
        id="product-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g. vitamin"
        autoComplete="off"
      />

      {visibleProducts.length === 0 ? (
        <p>No products match "{query.trim()}".</p>
      ) : (
        <ul>
          {visibleProducts.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

Scaled-up version for large catalogs (mention or write as a follow-up):

```jsx
import { useDeferredValue, useMemo, useState } from "react";

export default function ProductSearch({ products }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);   // input updates first, list catches up
  const isStale = query !== deferredQuery;

  // Pre-compute lowercase names once per products array, not per keystroke
  const indexed = useMemo(
    () => products.map((p) => ({ ...p, search: p.name.toLowerCase() })),
    [products]
  );

  const visibleProducts = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return q ? indexed.filter((p) => p.search.includes(q)) : indexed;
  }, [indexed, deferredQuery]);

  return (
    <section>
      <label htmlFor="product-search">Search products</label>
      <input id="product-search" type="search" value={query}
             onChange={(e) => setQuery(e.target.value)} />

      <p aria-live="polite">{visibleProducts.length} products found</p>

      <ul style={{ opacity: isStale ? 0.6 : 1 }}>
        {visibleProducts.slice(0, 100).map((p) => <li key={p.id}>{p.name}</li>)}
      </ul>
    </section>
  );
}
```

Why it works:
- **Derived state**: one source of truth (`query`), no `useEffect` sync, no stale `products` bug, one render per keystroke.
- **Case-insensitive + trimmed**: both sides lowercased, query trimmed, so "  IBUPROFEN " matches "Ibuprofen 400mg".
- **Empty query** returns the full list; **empty state** tells the user nothing matched instead of a blank area.
- **Stable keys** (`p.id`) keep list items correct when the list changes; index keys cause wrong DOM reuse.
- **Accessibility**: a real `<label>`, `type="search"`, and an `aria-live` result count.
- **Performance**: `useMemo` skips recomputation when unrelated state changes; `useDeferredValue` keeps the input responsive by rendering the big list at lower priority; rendering only the first 100 (or virtualizing with `react-window`/TanStack Virtual) keeps the DOM small.

Alternatives: debounce the query (200-300 ms) when each search triggers an API request; for typo-tolerant or fuzzy matching use a library like Fuse.js, or server-side search for very large catalogs.

## How to say it in the interview
- "I keep only the query in state and derive the filtered list during render; both sides are lowercased and the query trimmed, and an empty query shows everything."
- Call out the edge cases proactively: whitespace, no-results message, stable keys, accessible label. Interviewers grade this as much as the working code.
- Follow-up: "What if the list has 50,000 items?" `useMemo`, `useDeferredValue`, virtualization, or server-side search with debounce and request cancellation.
- Trap: storing `filteredProducts` in state and syncing it with `useEffect`; it adds a render, and forgetting a dependency shows stale results.
