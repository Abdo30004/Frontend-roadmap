# Centralized Error Handling, Token Refresh and Retry Logic for Simultaneous API Failures

**Level:** Senior
**Merged from (original phrasings):**
- How would you handle simultaneous API failures with centralized error handling and retry logic?

## The concept (short answer)

- **One HTTP client, one place for cross-cutting policy:** an axios instance with interceptors (or a `fetch` wrapper) handles auth headers, token refresh, retries, error normalization and logging. Components never re-implement this.
- **Single-flight token refresh:** when the access token expires, 10 parallel requests all get `401`. Only **one** refresh call must happen; the others wait on the same promise, then replay with the new token. Without this, refresh-token rotation makes 9 of 10 refreshes fail and the user is logged out.
- **Retry only what is safe:** retry transient failures (network error, `408`, `429`, `502/503/504`) and only **idempotent** requests (`GET`, `PUT`, `DELETE`, or `POST` with an `Idempotency-Key`). Never retry `400/401/403/404/422` - they will fail again.
- **Exponential backoff + jitter:** `delay = random(0, base * 2^attempt)` ("full jitter") so thousands of clients do not retry in lockstep and DDoS a recovering server. Respect `Retry-After`. Cap attempts.
- **Normalize errors** into one shape (`{ kind, status, message, retryable }`) and route them: **global** handling for cross-cutting failures (offline banner, session expired -> login, one deduplicated toast for 5xx), **local** handling for errors the component can explain (validation messages next to fields, "not found" page, inline retry in a widget).

## Real-life example: the problem

A banking dashboard loads accounts, cards, transactions, notifications and limits in parallel. After 15 minutes of inactivity the access token expires. The user clicks "Refresh": six requests get `401`, the interceptor fires six refresh calls, the backend rotates the refresh token on the first call and treats the next five as token reuse - it revokes the session. The user is logged out mid-task. Separately, a flaky `503` on "Transfer money" was retried automatically and the transfer went through **twice**. And the screen showed six identical red "Something went wrong" toasts.

```js
const api = axios.create({ baseURL: '/api' });

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error.config;
    if (error.response?.status === 401) {
      // Every failing request starts its own refresh
      const { data } = await axios.post('/api/auth/refresh');
      tokenStore.set(data.accessToken);
      config.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(config);
    }
    // Retries everything, including POST /transfers, immediately and forever
    if (!error.response || error.response.status >= 500) {
      return api(config);
    }
    toast.error('Something went wrong');   // one toast per failed request
    throw error;
  }
);
```

## How to fix it

```js
const api = axios.create({ baseURL: '/api', timeout: 15_000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- single-flight refresh: all concurrent 401s share one promise
let refreshPromise = null;
function refreshAccessToken() {
  refreshPromise ??= axios                       // plain axios: no interceptors, no recursion
    .post('/api/auth/refresh', null, { withCredentials: true })
    .then(({ data }) => { tokenStore.set(data.accessToken); return data.accessToken; })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

const IDEMPOTENT = new Set(['get', 'head', 'options', 'put', 'delete']);
const RETRYABLE_STATUS = new Set([408, 429, 502, 503, 504]);
const MAX_RETRIES = 3;

api.interceptors.response.use(undefined, async (error) => {
  const config = error.config;
  const status = error.response?.status;
  if (!config || axios.isCancel(error)) throw error;

  if (status === 401 && !config._authRetried) {
    config._authRetried = true;
    try {
      const token = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return api(config);                          // replay original request once
    } catch (refreshError) {
      authEvents.emit('session-expired');          // global: redirect to login once
      throw normalizeError(refreshError);
    }
  }

  const safeToRetry = IDEMPOTENT.has(config.method) || config.headers['Idempotency-Key'];
  const transient = !error.response || RETRYABLE_STATUS.has(status);
  config._retryCount ??= 0;

  if (safeToRetry && transient && config._retryCount < MAX_RETRIES) {
    config._retryCount += 1;
    const retryAfter = Number(error.response?.headers?.['retry-after']) * 1000;
    const backoff = Math.random() * Math.min(10_000, 300 * 2 ** config._retryCount); // full jitter
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : backoff);
    return api(config);
  }

  const normalized = normalizeError(error);
  if (normalized.kind === 'server' || normalized.kind === 'network') {
    notify.global(normalized);                     // deduplicated by kind within a time window
  }
  throw normalized;                                // callers handle 4xx locally
});

function normalizeError(error) {
  const status = error.response?.status;
  if (!error.response) return { kind: 'network', status: 0, message: 'You appear to be offline.', retryable: true };
  if (status >= 500) return { kind: 'server', status, message: 'Service temporarily unavailable.', retryable: true };
  return { kind: 'client', status, message: error.response.data?.message ?? 'Request failed.', fieldErrors: error.response.data?.errors, retryable: false };
}
```

Mutations that must be retry-safe get an idempotency key generated once per user intent:

```js
const key = crypto.randomUUID();                 // created when the user clicks "Send", reused on retries
api.post('/transfers', payload, { headers: { 'Idempotency-Key': key } });
```

Why it works: the shared `refreshPromise` collapses N concurrent 401s into one refresh, the rest await it and replay; the auth flag prevents infinite 401 loops. Retries happen only for transient errors on idempotent requests, spaced with jittered backoff, so a struggling server is not stampeded and money is never sent twice (the server dedupes by idempotency key). Errors reach components in one predictable shape, cross-cutting ones are shown once globally, and field validation stays local. Alternative: proactively refresh shortly before `exp` to avoid most 401s; in TanStack Query, set `retry` per query and a `QueryCache` `onError` for global toasts.

## How to say it in the interview

- "One client with interceptors owns auth, retries and error normalization. Concurrent 401s go through a single-flight refresh promise, then the original requests are replayed once."
- "I retry only transient errors on idempotent requests, with exponential backoff plus jitter and `Retry-After`; non-idempotent mutations need an idempotency key or are not retried."
- Trap: the refresh call itself going through the same interceptor (infinite loop), or retrying a `POST /payments` blindly. Follow-up: circuit breaker - stop retrying after repeated failures and show a degraded mode.
- Trade-off: retries improve resilience but add latency and load; global toasts are consistent but generic, so component-specific errors should still be rendered locally (error boundaries per widget).
