# How do you build an API hook with cancellation, retries, error handling, and no race conditions?

**Level:** Mid
**Merged from (original phrasings):**
- How do you implement API calls and error handling in React?
- How would you build a custom API hook with cancellation, retries, and error handling?
- How do you prevent race conditions when fetching inside effects?

## The concept (short answer)
- A **race condition** happens when request A starts, then request B starts (the user changed the filter), and **A finishes last**. A's old data overwrites B's. The UI shows results that don't match the current input.
- Two tools in the effect cleanup:
  - **`AbortController`**: cancels the network request itself (saves bandwidth; `fetch` rejects with `AbortError`).
  - **`ignore` flag**: `let ignore = false; return () => { ignore = true }`. Even if a response arrives, it is not written to state. Works for any Promise (SDKs, GraphQL clients that can't abort).
- **Error handling**: `fetch` does **not** reject on HTTP 404/500, so check `res.ok`. Separate states: `loading`, `error`, `data` (or a status enum). Show a retry button and keep old data where it makes sense.
- **Retries**: only for transient failures (network errors, 5xx, 429), never for 4xx validation errors. Use **exponential backoff with jitter** (e.g. 500ms, 1s, 2s + random) and a max attempt count. Respect `Retry-After` on 429.
- Production answer: **TanStack Query** (or SWR, or server fetching in React Server Components). It handles caching, dedup, cancellation, retries with backoff, refetch on focus and stale-while-revalidate. A custom hook is good to show you understand the mechanics.

## Real-life example: the problem
On a flight search page, the user types "Par", then quickly "Paris". The request for "Par" is slow (big result set) and arrives after "Paris". The list shows airports for "Par" (Parma, Paro...) under the "Paris" input. When the API returns a 500 error, the page shows "undefined" because `fetch` didn't throw, and a short Wi-Fi drop leaves the page empty forever.

```jsx
function useAirports(query) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/airports?q=${query}`)
      .then((res) => res.json())       // 500 HTML/JSON error parsed as data
      .then((json) => {
        setData(json.items);           // BUG: an older response can arrive last and win
        setLoading(false);
      });                              // no catch: network error -> loading forever
  }, [query]);

  return { data, loading };
}
```

## How to fix it
```js
import { useCallback, useEffect, useState } from 'react';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });
  });

const isRetryable = (err) =>
  err.name === 'TypeError' ||                                    // network failure
  (err instanceof HttpError && (err.status >= 500 || err.status === 429));

async function fetchJson(url, { signal, retries = 3, baseDelay = 500 }) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new HttpError(res.status, `Request failed: ${res.status}`);
      return await res.json();
    } catch (err) {
      if (signal.aborted || attempt >= retries || !isRetryable(err)) throw err;
      const delay = baseDelay * 2 ** attempt + Math.random() * 200; // backoff + jitter
      await sleep(delay, signal);
    }
  }
}

export function useApi(url) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let ignore = false;

    setState((s) => ({ ...s, status: 'loading', error: null })); // keep old data while loading

    fetchJson(url, { signal: controller.signal })
      .then((data) => { if (!ignore) setState({ status: 'success', data, error: null }); })
      .catch((error) => {
        if (ignore || error.name === 'AbortError') return;
        setState((s) => ({ ...s, status: 'error', error }));
      });

    return () => {
      ignore = true;        // never write a stale response
      controller.abort();   // and cancel it on the network
    };
  }, [url, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);
  return { ...state, retry };
}

// Usage
function AirportSearch({ query }) {
  const { status, data, error, retry } = useApi(
    query ? `/api/airports?q=${encodeURIComponent(query)}` : null
  );
  if (status === 'error') return <ErrorBox message={error.message} onRetry={retry} />;
  return <AirportList items={data?.items ?? []} loading={status === 'loading'} />;
}
```
Why it works: each effect run owns one `AbortController` and one `ignore` flag. When `query` changes, the cleanup aborts the old request and marks it as ignored before the new one starts, so only the latest response can update state. `res.ok` turns HTTP errors into real errors. Transient failures retry with growing delays, and the retry wait is also cancelable. The UI has explicit loading/error/success states and a manual retry.

### The production version
```jsx
const { data, error, isPending, refetch } = useQuery({
  queryKey: ['airports', query],
  queryFn: ({ signal }) => fetchJson(`/api/airports?q=${encodeURIComponent(query)}`, { signal, retries: 0 }),
  enabled: query.length > 1,
  retry: 3,                // built-in exponential backoff
  staleTime: 60_000,
});
```
Results are cached per key, so typing "Paris" -> "Par" -> "Paris" shows the cached result instantly. Race conditions can't happen because data is stored by key.

## How to say it in the interview
- "Fetching in an effect needs a cleanup: `AbortController` to cancel the request and an `ignore` flag so a late response never overwrites newer state."
- "`fetch` only rejects on network errors, so I check `res.ok`. I retry only transient errors (network, 5xx, 429) with exponential backoff and jitter."
- "In production I use TanStack Query or fetch in Server Components. A custom hook usually ends up re-implementing caching, dedup and refetching, badly."
- Trade-off/trap: retries hide outages from users but add load on a struggling server. Jitter and a retry limit prevent a "thundering herd". Never auto-retry non-idempotent requests like `POST /payments` without an idempotency key.
