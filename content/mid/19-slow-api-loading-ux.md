# The API takes 5 seconds to respond. What does the user see meanwhile?

**Level:** Mid
**Merged from (original phrasings):**
- The API takes 5 seconds to respond. What does the user see meanwhile?

## The concept (short answer)
- **Never a blank screen or a frozen UI.** Show something immediately, show progress, and keep the rest of the page usable.
- **Skeletons** that match the final layout, rather than a full-page spinner. Perceived speed improves and the layout does not shift (CLS) when data arrives.
- **Show stale data first:** cache previous responses (React Query/SWR `staleTime`, stale-while-revalidate) and render them instantly while refetching in the background, with a subtle "Updating..." indicator.
- **Progressive or streamed rendering:** don't block the whole page on the slowest call. Each section gets its own loading state or Suspense boundary, and Next.js streaming sends the shell first.
- **Optimistic UI** for mutations: update the UI immediately and roll back on error (likes, toggles, adding to a cart).
- **Escalating feedback:** a spinner after about 300 ms (avoids flicker on fast responses), a message after about 3 s ("Still working, searching 400 hotels..."), and a **timeout** with retry after about 10-15 s.
- **Cancellation:** `AbortController` lets the user leave or change the query without stale responses overwriting newer ones.
- And report the 5 s to the backend team as a bug: caching, pagination, or an async job with polling or webhooks may be the real fix.

## Real-life example: the problem
On an insurance comparison site, the "Get quotes" page calls an aggregator that takes 3-8 s. Users see a white page with a centered spinner and no text. Many assume it is broken and click "Back" or refresh, which sends another 8-second request. If they change the car model while the first request is still running, the old response arrives last and overwrites the new results, so users see quotes for the wrong car. Analytics show 35% abandonment on this page.

```jsx
function QuotesPage({ carId }) {
  const [quotes, setQuotes] = useState(null);

  useEffect(() => {
    setQuotes(null);
    fetch(`/api/quotes?car=${carId}`)          // no timeout, no cancel
      .then(r => r.json())
      .then(setQuotes);                        // a late response for an old carId still wins
  }, [carId]);

  if (!quotes) return <div className="spinner" />;  // whole page replaced by a spinner
  return <QuoteList quotes={quotes} />;
}
```

## How to fix it
```jsx
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

async function fetchQuotes(carId, signal) {
  const timeout = AbortSignal.timeout(15000);
  const res = await fetch(`/api/quotes?car=${carId}`, {
    signal: AbortSignal.any([signal, timeout]), // cancelled on unmount/key change OR after 15 s
  });
  if (!res.ok) throw new Error(`Quotes failed: ${res.status}`);
  return res.json();
}

function useElapsed(active) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!active) { setMs(0); return; }
    const start = Date.now();
    const id = setInterval(() => setMs(Date.now() - start), 500);
    return () => clearInterval(id);
  }, [active]);
  return ms;
}

function QuotesPage({ carId }) {
  const { data, isPending, isFetching, isPlaceholderData, error, refetch } = useQuery({
    queryKey: ['quotes', carId],
    queryFn: ({ signal }) => fetchQuotes(carId, signal), // React Query aborts outdated requests
    staleTime: 5 * 60 * 1000,                            // revisiting the page is instant
    placeholderData: keepPreviousData,                   // keep old results visible while refetching
  });
  const elapsed = useElapsed(isFetching);

  return (
    <main>
      <SearchSummary carId={carId} />           {/* the page frame is usable immediately */}

      {isFetching && elapsed > 3000 && (
        <p role="status" aria-live="polite">
          Still comparing 40+ insurers. This usually takes under 10 seconds.
        </p>
      )}

      {error ? (
        <ErrorPanel
          message={error.name === 'TimeoutError' ? 'This is taking longer than usual.' : 'Could not load quotes.'}
          onRetry={() => refetch()}
        />
      ) : isPending ? (
        <QuoteListSkeleton rows={5} />           // same shape as the real list, no layout shift
      ) : (
        <div aria-busy={isFetching} style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
          <QuoteList quotes={data} />
        </div>
      )}
    </main>
  );
}
```

Why it works:
- Users see the page frame and a skeleton right away, then an honest progress message, so they know the page is working.
- `keepPreviousData` plus `staleTime` means changing filters or coming back to the page shows cached quotes instantly instead of a blank screen.
- Abort signals cancel outdated requests, so a slow old response can no longer overwrite the new one (race condition fixed), and the timeout turns an endless spinner into a clear retry option.
- Further improvements: stream partial results (SSE, or the BFF returns insurers as they respond) or render each section under its own `<Suspense>` boundary in Next.js.

## How to say it in the interview
- "I design for the wait: a skeleton immediately, cached or stale data if I have it, escalating messages, a timeout with retry, and cancellation so stale responses can't win the race."
- "For writes I use optimistic updates with rollback. For reads I use stale-while-revalidate."
- Trap: a full-page spinner. It hides everything the user could already use, and a spinner shown for under 300 ms just flickers. Delay it, or use skeletons.
- Trade-off: optimistic UI and stale data can briefly show wrong information. That is fine for a like counter, not for a bank balance or a final price. Choose per feature.
