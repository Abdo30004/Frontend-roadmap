# SSR vs. CSR vs. hydration (and SSG/ISR): how do they differ, and when should you use each?

**Level:** Mid
**Merged from (original phrasings):**
- Explain SSR (Server-Side Rendering) and CSR (Client-Side Rendering).
- SSR vs. CSR vs. hydration: how do they differ, and when should you use them?
- Explain the concept of server-side rendering (SSR) in Next.js.
- How do you implement server-side rendering with hydration for complex applications?

## The concept (short answer)
- **CSR:** the server sends an almost empty HTML shell and a JS bundle, and the browser fetches data and builds the DOM. You get a blank screen or spinner until the JS runs, and weaker SEO and social previews. It suits authenticated dashboards and highly interactive apps.
- **SSR:** the server runs the React components for each request and sends full HTML. You get a fast first paint (FCP/LCP), SEO-friendly content, and per-request data such as personalization and auth. The costs are server CPU per request and a slower TTFB if data fetching is slow.
- **SSG / ISR:** HTML is rendered at build time (SSG), or rendered and then regenerated in the background after N seconds or on demand (ISR). The page is served from a CDN, so it is the fastest option. It suits marketing pages, blogs and product pages.
- **Hydration:** SSR HTML is not interactive. The browser downloads the same JS, React renders again in memory, then attaches event handlers to the existing DOM instead of recreating it. The client's first render must produce the same markup as the server's, otherwise you get a **hydration mismatch**.
- **In Next.js App Router:** components are Server Components by default (rendered on the server, with no JS shipped for them). `'use client'` marks interactive islands that get hydrated. A route is static or dynamic depending on what it uses (`cookies()`, `headers()`, uncached fetch).
- **Complex apps:** use **streaming SSR with Suspense** so the shell is sent immediately and slow sections stream in as they resolve, with **selective hydration** (React hydrates the parts the user interacts with first). Keep client components small so there is less JS to hydrate.

## Real-life example: the problem
On a travel-booking site, the search results page is server-rendered. In production, users in other time zones see the "Departs at" times flash from one value to another on load. Sentry also logs `Hydration failed because the server rendered text didn't match the client`, and a promo banner sometimes loses its click handler. The cause: the server (UTC) and the browser (user's time zone) format the date differently, and the component reads `window`/`localStorage` during render.

```jsx
'use client';

export function FlightCard({ flight }) {
  // Server (UTC): "08:00". Browser (UTC+2): "10:00", so a mismatch
  const departs = new Date(flight.departureIso).toLocaleTimeString();

  // Server: window is undefined, so false. Client: maybe true, so different markup
  const isReturning = typeof window !== 'undefined' && localStorage.getItem('seenPromo');

  return (
    <article>
      <h3>{flight.route}</h3>
      <p>Departs at {departs}</p>
      {!isReturning && <PromoBanner />}
    </article>
  );
}
```

React cannot match the server HTML. Depending on the version, it either throws away and re-renders the subtree on the client (slow, causes a visible flash) or, with React 19, logs the error and recovers by client-rendering up to the nearest Suspense boundary. Either way, users see content jump and the first render loses its SSR benefit.

## How to fix it
```jsx
'use client';
import { useEffect, useState } from 'react';

export function FlightCard({ flight }) {
  // 1. Deterministic formatting: fixed locale + the airport's time zone (sent by the server)
  const departs = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: flight.originTimeZone,
  }).format(new Date(flight.departureIso));

  // 2. Browser-only state is read AFTER hydration, in an effect
  const [isReturning, setIsReturning] = useState(false); // same initial value on server and client
  useEffect(() => {
    setIsReturning(localStorage.getItem('seenPromo') === '1');
  }, []);

  return (
    <article>
      <h3>{flight.route}</h3>
      <p>Departs at <time dateTime={flight.departureIso}>{departs}</time></p>
      {!isReturning && <PromoBanner />}
    </article>
  );
}
```

And stream the slow part of the page instead of blocking the whole response:

```jsx
// app/search/page.jsx (Server Component)
import { Suspense } from 'react';

export default async function SearchPage({ searchParams }) {
  const { from, to } = await searchParams; // Next 15: searchParams is a Promise
  return (
    <>
      <SearchForm from={from} to={to} />                 {/* sent immediately */}
      <Suspense fallback={<ResultsSkeleton />}>
        <FlightResults from={from} to={to} />            {/* streams in when the API responds */}
      </Suspense>
    </>
  );
}
```

Why it works: the first client render now produces exactly the same HTML as the server, so hydration only attaches handlers. Browser-specific values are applied in a second render after mount. Streaming means a slow flights API delays only the results section, not the TTFB of the whole page.

Alternatives: `suppressHydrationWarning` on a single element whose text legitimately differs, such as a timestamp (it works one level deep only and is not a general fix); `next/dynamic(() => import(...), { ssr: false })` for components that cannot run on the server at all (charts, maps).

## How to say it in the interview
- "SSR gives you HTML fast, hydration makes it interactive, and the contract between them is that the client's first render must match the server's output exactly."
- "I choose per route: SSG/ISR for content that is the same for everyone, SSR or streaming for personalized or fresh data, CSR for app-like screens behind a login."
- Trap: "SSR makes the page faster." It improves FCP/LCP, but time to interactive still depends on JS size. A page can look ready and still ignore clicks until hydration finishes (the "uncanny valley").
- Common mismatch causes: `Date`/`Math.random()` during render, `window`/`localStorage` checks, invalid HTML nesting (`<div>` inside `<p>`), and browser extensions changing the DOM.
