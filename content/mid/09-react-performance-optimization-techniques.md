# What techniques do you use to optimize React application performance?

**Level:** Mid
**Merged from (original phrasings):**
- What are the different React optimization techniques?
- How do you improve the performance of a React application?
- How do you optimize React applications for performance?

## The concept (short answer)
Start by **measuring** (Lighthouse/Core Web Vitals for loading, the React DevTools Profiler and the Performance panel for runtime). Then pick the technique that matches the bottleneck:

| Problem | Technique |
|---|---|
| Components re-render for no reason | State colocation, `memo` + `useMemo`/`useCallback`, React Compiler (deep dive: `08-unnecessary-rerenders-and-memo.md`) |
| Expensive calculation on every render | `useMemo`, or move it to the server / a Web Worker |
| Big JS bundle, slow first load | Code splitting with `React.lazy`, dynamic `import()`, route-level chunks (deep dive: `13-lazy-loading-code-splitting.md`) |
| Long lists / big tables | Virtualization (`@tanstack/react-virtual`, `react-window`): render only the visible rows |
| Typing feels laggy while a big list updates | `useTransition` / `useDeferredValue`: mark heavy updates as non-urgent |
| Context update re-renders the whole app | Split contexts, memoize the value, or use a selector-based store (Zustand) |
| Slow LCP, layout shift | Image optimization: `next/image` or `srcset`, modern formats, explicit sizes, `loading="lazy"` below the fold, `fetchpriority="high"` for the hero |
| Waterfalls of requests | Fetch on the server (RSC), parallel requests, caching with TanStack Query |

Short notes on each:
- **Memoization**: helps only when the props are stable and the skipped work is expensive. Don't wrap everything.
- **State colocation**: keep state in the lowest component that needs it; frequent updates then re-render a small subtree.
- **Code splitting**: ship only the JS for the current route; load heavy widgets (editors, charts, maps) on demand.
- **Virtualization**: 10,000 rows in the DOM is slow no matter how well you memoize. Render about 30.
- **Transitions**: keep input responsive by letting React interrupt non-urgent rendering.
- **Images**: usually the biggest bytes on the page and the most common LCP element.

## Real-life example: the problem
A real-estate listing site: the search page loads in 6 seconds on mobile (LCP 5.8s), and typing in the "City" filter freezes the page for a moment on each keystroke. A typical case: a team sees bad Core Web Vitals in Search Console and no one knows where to start.

```jsx
import { MapView } from './MapView'; // ~400KB map library, loaded on every page

export default function SearchPage({ listings }) { // 3,000 listings
  const [city, setCity] = useState('');
  const filtered = listings.filter((l) => l.city.toLowerCase().includes(city.toLowerCase()));

  return (
    <>
      <img src="/hero-4000px.jpg" />                    {/* 2.5MB, no size, no priority */}
      <input value={city} onChange={(e) => setCity(e.target.value)} />
      <MapView listings={filtered} />
      <ul>
        {filtered.map((l) => <ListingCard key={l.id} listing={l} />)} {/* 3,000 DOM rows */}
      </ul>
    </>
  );
}
```
Profiler + Lighthouse findings: big hero image is the LCP, the map library blocks the main bundle, and each keystroke renders 3,000 cards plus the map.

## How to fix it
```jsx
'use client'; // Next.js App Router: this page section uses state and hooks

import { lazy, Suspense, useDeferredValue, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useVirtualizer } from '@tanstack/react-virtual';

const MapView = lazy(() => import('./MapView')); // separate chunk, loaded when rendered

export default function SearchPage({ listings }) {
  const [city, setCity] = useState('');
  const deferredCity = useDeferredValue(city); // input updates first, list follows

  const filtered = useMemo(() => {
    const q = deferredCity.toLowerCase();
    return listings.filter((l) => l.city.toLowerCase().includes(q));
  }, [listings, deferredCity]);

  const parentRef = useRef(null);
  const rows = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
  });

  return (
    <>
      <Image src="/hero.jpg" alt="Homes for sale" width={1200} height={500} priority sizes="100vw" />
      <input value={city} onChange={(e) => setCity(e.target.value)} />
      <Suspense fallback={<div className="map-skeleton" />}>
        <MapView listings={filtered} />
      </Suspense>
      <div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
        <div style={{ height: rows.getTotalSize(), position: 'relative' }}>
          {rows.getVirtualItems().map((v) => (
            <div key={filtered[v.index].id}
                 style={{ position: 'absolute', top: 0, width: '100%', transform: `translateY(${v.start}px)` }}>
              <ListingCard listing={filtered[v.index]} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
```
Why it works: the hero image is resized, served in a modern format and loaded with high priority (better LCP). The map code is in its own chunk (smaller main bundle). `useDeferredValue` keeps the input instant while the list catches up in an interruptible render. Virtualization keeps only the visible cards in the DOM. Each fix targets a measured bottleneck.

## How to say it in the interview
- "I measure first, then separate **loading** performance (bundle size, images, data waterfalls) from **runtime** performance (re-renders, big DOM, blocking work). Each has different tools."
- "My top wins are usually: code splitting, image optimization, virtualization of long lists, and state colocation. Memoization comes after that, or the React Compiler handles it."
- Trap: "I use `useMemo` everywhere." The interviewer will ask how you know it helped. Answer with a Profiler before/after.
- Trade-off: every optimization adds complexity (loading states for lazy chunks, fixed row heights for virtualization, stale-looking UI with deferred values). Apply them where the numbers justify it.
