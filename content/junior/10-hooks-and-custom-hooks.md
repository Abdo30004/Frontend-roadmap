# What are React hooks, and how do you create a custom hook?

**Level:** Junior
**Merged from (original phrasings):**
- What are React hooks and how do you create custom hooks?

## The concept (short answer)
- **Hooks** are functions starting with `use` that let function components use React features: state (`useState`, `useReducer`), side effects (`useEffect`), refs (`useRef`), context (`useContext`), memoization (`useMemo`, `useCallback`), and more.
- React stores each component's hook data in a list and matches it **by call order** on every render. That is why the **Rules of Hooks** exist:
  1. Call hooks only at the **top level**: never inside `if`, loops, nested functions or after an early `return`.
  2. Call hooks only from **React function components or custom hooks**, not from regular functions or event handlers.
- A **custom hook** is your own function whose name starts with `use` and that calls other hooks. It lets you **reuse stateful logic** (not UI) between components.
- Each component that calls a custom hook gets its **own independent state**. Custom hooks share logic, not data.
- The ESLint plugin `eslint-plugin-react-hooks` checks the rules and missing effect dependencies.

## Real-life example: the problem
Imagine a news site where the article page and the comments section both need to know if the visitor is on a mobile screen, and the newsletter popup needs the same. The same `resize` code was copy-pasted into three components; one copy forgot to remove its listener, so the page got **slower after each navigation**. Another copy put a hook inside an `if`, and users who logged in mid-session saw the page **crash** with "Rendered more hooks than during the previous render".

```jsx
// BROKEN: ArticlePage.jsx
import { useEffect, useState } from 'react';

export function ArticlePage({ article, user }) {
  if (!article) return <p>Loading...</p>;      // early return BEFORE hooks

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    // no cleanup -> listener stays after unmount
  }, []);

  if (user) {
    const [saved, setSaved] = useState(false); // hook inside a condition
  }

  return isMobile ? <MobileArticle article={article} /> : <DesktopArticle article={article} />;
}
```

When `article` goes from `undefined` to loaded, or `user` goes from `null` to logged in, the number and order of hooks changes between renders, so React cannot match its stored data and throws.

## How to fix it
Extract the reusable logic into a custom hook with proper cleanup, and call every hook at the top level before any early return.

```jsx
// FIXED: hooks/useMediaQuery.js
import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);

    setMatches(mql.matches);                    // sync if query changed
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange); // cleanup
  }, [query]);

  return matches;
}
```

```jsx
// FIXED: ArticlePage.jsx
import { useState } from 'react';
import { useMediaQuery } from './hooks/useMediaQuery';

export function ArticlePage({ article, user }) {
  const isMobile = useMediaQuery('(max-width: 767px)'); // top level
  const [saved, setSaved] = useState(false);            // top level, always called

  if (!article) return <p>Loading...</p>;               // early return AFTER hooks

  return (
    <>
      {user && (
        <button onClick={() => setSaved(true)} disabled={saved}>
          {saved ? 'Saved' : 'Save for later'}
        </button>
      )}
      {isMobile ? <MobileArticle article={article} /> : <DesktopArticle article={article} />}
    </>
  );
}

// Reused anywhere, each component with its own state:
// const isMobile = useMediaQuery('(max-width: 767px)');
// const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
```

Why it works: hooks are now called in the same order on every render, so React can match its stored state. The condition moved into the JSX (or into the hook's logic), not around the hook call. The custom hook puts the listener and its cleanup in one place, so no component can forget it. `matchMedia` only fires when the breakpoint is crossed, not on every pixel of resize.

Another tiny, common custom hook:

```jsx
import { useCallback, useState } from 'react';

export function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn((v) => !v), []);
  return [on, toggle];
}
```

For data fetching, prefer a library (TanStack Query, SWR) or framework features over a hand-written `useFetch`.

## How to say it in the interview
- "Hooks let function components use state, effects, refs and context. React tracks them by call order, so they must be called at the top level, always in the same order."
- "A custom hook is a function starting with `use` that calls other hooks; it shares logic, not state. Each component that uses it gets its own copy."
- Trap: putting a hook after an early `return` or inside an `if` breaks the order and causes 'Rendered more/fewer hooks' errors.
- Trade-off: do not turn every small piece of code into a hook; extract one when logic is reused or when it makes a component clearly easier to read. Hide effects and cleanup inside the hook so callers cannot misuse them.
