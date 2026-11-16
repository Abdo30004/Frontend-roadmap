# Diagnosing Slow Pages and Real-Device Performance (Core Web Vitals)

**Level:** Senior
**Merged from (original phrasings):**
- How would you diagnose a React page that takes 5 seconds to become interactive?
- Your app is fast locally but slow on real Android devices. What do you measure first?
- How do you optimize web performance and reduce load times?

## The concept (short answer)

- **Measure real users first (field data), then reproduce in the lab.** Field data = RUM (the `web-vitals` library sending to your analytics) and CrUX / Search Console. Lab data = Lighthouse, DevTools Performance panel, WebPageTest. Your MacBook on fiber is roughly 4-6x faster at JS than a mid-range Android; lab without **CPU throttling (4x-6x)** and network throttling lies.
- **Core Web Vitals (judged at the 75th percentile):**
  - **LCP** (Largest Contentful Paint, loading) <= 2.5s - break down into TTFB, resource load delay, resource load time, render delay.
  - **INP** (Interaction to Next Paint, responsiveness, replaced FID in 2024) <= 200ms - input delay + processing time + presentation delay.
  - **CLS** (Cumulative Layout Shift, stability) <= 0.1 - reserve space for images/ads/fonts.
- **"5 seconds to interactive" is almost always main-thread JS:** big bundles to parse, **hydration** of a huge client tree, expensive work in render/effects, third-party scripts. Look for **long tasks** (> 50ms) in the Performance panel; any long task blocks input.
- **Fixes by cause:** ship less JS (Server Components, code splitting), hydrate less (keep static parts server-only, islands), break up long tasks (`scheduler.yield()`, `setTimeout`, transitions), virtualize long lists, defer third-party scripts, preload the LCP image, render critical content in HTML.

## Real-life example: the problem

A second-hand marketplace's search results page. Lighthouse on the developer laptop: 98. RUM shows p75 INP of 600ms and LCP of 4.8s on Android; users tap "Filters" and nothing happens for seconds, then the page jumps. Performance trace with 6x CPU throttling: a 3.2s long task at load (hydrating 500 listing cards + sorting + date formatting), a chat widget and two analytics tags loading synchronously, and the hero image only discovered after JS runs.

```tsx
'use client';                                            // entire page hydrates on the client
import { useEffect, useState } from 'react';
import ChatWidget from 'heavy-chat-sdk';

export default function SearchPage({ initialListings }) {
  const [listings, setListings] = useState([]);

  useEffect(() => {
    // Expensive sync work right after hydration: one giant long task
    const enriched = initialListings
      .map((l) => ({ ...l, score: computeRelevance(l), price: formatPrice(l.price) }))
      .sort((a, b) => b.score - a.score);
    setListings(enriched);                               // empty list first -> layout shift
  }, [initialListings]);

  return (
    <>
      <div className="hero" style={{ backgroundImage: `url(${initialListings[0]?.photo})` }} />
      <FiltersPanel />
      <div className="grid">{listings.map((l) => <ListingCard key={l.id} listing={l} />)}</div>
      <ChatWidget />
    </>
  );
}
```

## How to fix it

First, measure in the field with attribution so you know *which* element and *which* interaction is slow:

```js
// rum.js - loaded once in the root layout (client)
import { onCLS, onINP, onLCP, onTTFB } from 'web-vitals/attribution';

function send(metric) {
  const body = JSON.stringify({
    name: metric.name, value: metric.value, rating: metric.rating, id: metric.id,
    page: location.pathname,
    device: { mem: navigator.deviceMemory, cpus: navigator.hardwareConcurrency, net: navigator.connection?.effectiveType },
    attribution: metric.name === 'INP'
      ? { target: metric.attribution.interactionTarget, inputDelay: metric.attribution.inputDelay,
          processing: metric.attribution.processingDuration, presentation: metric.attribution.presentationDelay }
      : metric.name === 'LCP'
      ? { target: metric.attribution.target, ttfb: metric.attribution.timeToFirstByte,
          loadDelay: metric.attribution.resourceLoadDelay, renderDelay: metric.attribution.elementRenderDelay }
      : metric.name === 'CLS' ? { target: metric.attribution.largestShiftTarget } : {},
  });
  if (!navigator.sendBeacon?.('/rum', body)) fetch('/rum', { method: 'POST', body, keepalive: true });
}

[onCLS, onINP, onLCP, onTTFB].forEach((fn) => fn(send));
```

Then fix the causes: render the list on the server, hydrate only the interactive leaves, do the heavy work where it belongs, and defer third parties.

```tsx
// app/search/page.tsx - Server Component: no hydration cost for 500 static cards
import Image from 'next/image';
import Script from 'next/script';
import { FiltersPanel } from './FiltersPanel';           // 'use client' leaf
import { ListingGrid } from './ListingGrid';             // server-rendered, virtualized if huge

export default async function SearchPage({ searchParams }) {
  const listings = await searchListings(await searchParams); // relevance sort done in the DB/search engine
  return (
    <>
      <Image src={listings[0].photo} alt="" width={1200} height={400} priority /> {/* preloaded LCP, fixed size: no CLS */}
      <FiltersPanel />
      <ListingGrid listings={listings} />
      <Script src="https://chat.example.com/widget.js" strategy="lazyOnload" />
    </>
  );
}
```

For unavoidable client-side work, yield to the main thread so taps are handled between chunks:

```js
const yieldToMain = () =>
  globalThis.scheduler?.yield ? scheduler.yield() : new Promise((r) => setTimeout(r, 0));

async function enrichInChunks(items, chunkSize = 50) {
  const out = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    out.push(...items.slice(i, i + chunkSize).map(enrich));
    await yieldToMain();                                 // no task longer than ~50ms
  }
  return out;
}
```

Why it works: field data with attribution points at the exact element and interaction; server rendering removes hundreds of components from hydration (the 3.2s long task disappears); the LCP image is in the HTML with `priority` (preloaded) and fixed dimensions; the chat SDK loads after the page is idle; chunked work keeps every task short so INP stays under 200ms. Verify by re-running the trace with 6x CPU throttling and watching p75 in RUM over the next days.

## How to say it in the interview

- "Field data first - RUM with web-vitals attribution, segmented by device class - because the lab on a developer machine hides CPU cost. Then I reproduce with CPU throttling and read long tasks in the Performance panel."
- "LCP is a loading problem (server, critical path, image priority), INP is a main-thread problem (long tasks, hydration, heavy handlers), CLS is a reserved-space problem."
- Trap: optimizing the Lighthouse score instead of p75 field data; and "TTI" is not a Core Web Vital anymore - talk about INP and Total Blocking Time. Follow-up: how to find slow interactions - INP attribution plus the Long Animation Frames API.
- Trade-off: moving work to the server lowers client CPU but raises TTFB and server cost; stream with Suspense so TTFB stays low.
