# How do you detect and prevent unnecessary re-renders, and when does memo fail?

**Level:** Mid
**Merged from (original phrasings):**
- How do you detect and prevent unnecessary re-renders in a large React application?
- When a parent re-renders, which children re-render, and when does memo fail?

## The concept (short answer)
- A component re-renders when **its state changes, its parent re-renders, or a context it reads changes**. By default, when a parent re-renders, **all children in its JSX re-render**, even if their props did not change.
- `React.memo(Child)` skips the re-render if every prop is **shallowly equal** (`Object.is`) to the previous one.
- memo **fails** when a prop is a new reference on every render:
  - inline objects/arrays: `style={{...}}`, `options={[...]}`, `filter={{ status }}`
  - inline functions: `onClick={() => ...}`
  - JSX passed as `children` (a new element object every render)
  - the child reads a context whose value changes (memo does not block context updates)
- Fixes: `useMemo`/`useCallback` for props passed to memoized children, **move state down** (colocation), **pass components as `children`** so they are created by a parent that does not re-render, split contexts.
- **Detect first, optimize second**: React DevTools Profiler (record, look at the flame graph, enable "Record why each component rendered"), "Highlight updates when components render", `why-did-you-render` in dev, and the `<Profiler>` API for timing in code.
- **React Compiler** (stable since late 2025) adds memoization automatically at build time, which removes most manual `useMemo`/`useCallback`/`memo`. You still need good state structure.

## Real-life example: the problem
In a CRM admin panel, typing in the "Quick note" textarea at the top of the customers page is laggy: each keystroke takes about 150ms. The Profiler shows that every keystroke re-renders the `CustomerTable` with 500 rows, even though the table is wrapped in `memo`.

```jsx
const CustomerTable = memo(function CustomerTable({ customers, filter, onSelect }) {
  const visible = customers.filter((c) => c.status === filter.status);
  return visible.map((c) => <CustomerRow key={c.id} customer={c} onSelect={onSelect} />);
});

function CustomersPage({ customers }) {
  const [note, setNote] = useState('');          // changes on every keystroke
  const [status, setStatus] = useState('active');
  const [selectedId, setSelectedId] = useState(null);

  return (
    <>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      <StatusTabs value={status} onChange={setStatus} />
      <CustomerTable
        customers={customers}
        filter={{ status }}                       // new object every render -> memo fails
        onSelect={(id) => setSelectedId(id)}      // new function every render -> memo fails
      />
      <CustomerDrawer id={selectedId} />
    </>
  );
}
```
Profiler, "Why did this render?": `Props changed: filter, onSelect`. The values are equal, but the references are new.

## How to fix it
Two steps: move the fast-changing state down, and keep props stable.

```jsx
// 1. State colocation: the note state lives in its own component.
function QuickNote() {
  const [note, setNote] = useState('');
  return <textarea value={note} onChange={(e) => setNote(e.target.value)} />;
}

function CustomersPage({ customers }) {
  const [status, setStatus] = useState('active');
  const [selectedId, setSelectedId] = useState(null);

  // 2. Stable references for the memoized child
  const filter = useMemo(() => ({ status }), [status]);
  const handleSelect = useCallback((id) => setSelectedId(id), []);

  return (
    <>
      <QuickNote />                       {/* typing re-renders only QuickNote */}
      <StatusTabs value={status} onChange={setStatus} />
      <CustomerTable customers={customers} filter={filter} onSelect={handleSelect} />
      <CustomerDrawer id={selectedId} />
    </>
  );
}
```
Why it works: typing now updates state inside `QuickNote`, so `CustomersPage` does not re-render at all. When the page does re-render (e.g. `selectedId` changes), `filter` and `handleSelect` keep the same references, so `memo` can skip the table. Simpler still: pass `status` (a string) instead of a `filter` object; primitives compare by value.

### The children-as-props pattern
```jsx
function ScrollTracker({ children }) {
  const [y, setY] = useState(0);
  useEffect(() => {
    const onScroll = () => setY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <div><ProgressBar value={y} />{children}</div>;
}

// <HeavyArticle /> is created by App, not by ScrollTracker,
// so scrolling re-renders ScrollTracker but NOT HeavyArticle.
<ScrollTracker><HeavyArticle /></ScrollTracker>
```

### Detection setup
```js
// src/wdyr.js, imported first in the dev entry only
import React from 'react';
if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, { trackAllPureComponents: true });
}
```
Note: `why-did-you-render` patches React internals and works best with React 18. With React 19 and the Compiler, rely mainly on the DevTools Profiler.

## How to say it in the interview
- "When a parent renders, all its children render by default. `memo` only helps if every prop is referentially stable, so inline objects, functions and `children` JSX silently break it."
- "I measure first with the Profiler. Most re-renders are cheap; I optimize only the ones that are slow or very frequent."
- "My first tools are structural: move state down, lift content up as `children`, split context. `useMemo`/`useCallback` come after that, and the React Compiler can do most of them automatically."
- Trade-off: memoization costs memory and comparisons, and adds code. Wrapping everything in `memo` without measuring can make the code slower and harder to read.
