# Dividing Caching Between Browser, CDN, Service Worker and API Layer

**Level:** Senior
**Merged from (original phrasings):**
- How would you divide caching between the browser, CDN, service worker and API layer?

## The concept (short answer)

Each layer caches a different thing, and `Cache-Control` is the contract between them:

- **Hashed static assets** (`app.3f9a1c.js`, fonts, images with content hash in the name): `Cache-Control: public, max-age=31536000, immutable`. The URL changes when the content changes, so caching "forever" in browser and CDN is safe.
- **HTML documents / `index.html`** (the entry point that references the hashes): `no-cache` for the browser (store but **revalidate** every time with ETag -> cheap `304`). At the CDN, either `no-cache` too, or `s-maxage=60, stale-while-revalidate=...` **plus a CDN purge on every deploy**. Never a long `max-age` on HTML.
- **CDN-specific directives:** `s-maxage` applies only to shared caches (CDN/proxy) and overrides `max-age` there; `stale-while-revalidate=N` serves the stale copy instantly while fetching a fresh one in the background; `Vary` declares which request headers change the response (e.g. `Accept-Encoding`, sometimes `Accept-Language`).
- **API responses:** user-specific data -> `private, no-store` (or `private, no-cache`) so no CDN ever stores it; public, shared data (product catalog, exchange rates) -> `public, s-maxage=60, stale-while-revalidate=300` at the edge.
- **Service worker:** offline support and instant repeat loads. Cache-first for hashed assets, **network-first** for navigations/HTML, network-first or stale-while-revalidate for selected API calls. It is a programmable cache that ignores HTTP semantics unless you implement them - most "stale app forever" bugs live here.
- **Client query cache (TanStack Query/SWR/RTK Query):** in-memory, per-session, for dedup and instant UI; tuned with `staleTime`, invalidated by mutations. It complements HTTP caching, it does not replace it.

## Real-life example: the problem

A typical case: a ride-booking web app deploys a new version at 10:00. From 10:00 to 11:00 a portion of users see a white screen with `ChunkLoadError: Loading chunk 482 failed` in Sentry. Others keep running last week's version with a known pricing bug, even after refreshing. Root causes:

1. `index.html` is cached by the CDN and browsers for an hour, so it still references `chunk-482.a1b2.js`, which was deleted from the bucket by the deploy.
2. A service worker serves `index.html` cache-first and only updates in the background - and the new SW sits in "waiting" until every tab is closed.

```nginx
# Same policy for everything
location / {
  root /var/www/app;
  add_header Cache-Control "public, max-age=3600";
  try_files $uri /index.html;
}
```

```js
// sw.js - cache-first for everything, including navigations
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

```yaml
# deploy step: wipes old assets
- run: aws s3 sync ./dist s3://app-bucket --delete
```

## How to fix it

```nginx
# Hashed, immutable build output
location /assets/ {
  root /var/www/app;
  add_header Cache-Control "public, max-age=31536000, immutable";
}

# HTML entry point: always revalidate (ETag -> 304 when unchanged)
location / {
  root /var/www/app;
  add_header Cache-Control "no-cache";
  try_files $uri /index.html;
}

# API: user data must never sit in a shared cache
location /api/me/ {
  proxy_pass http://api;
  add_header Cache-Control "private, no-store" always;
}

# API: public catalog, cached at the edge, refreshed in background
location /api/catalog/ {
  proxy_pass http://api;
  add_header Cache-Control "public, max-age=0, s-maxage=60, stale-while-revalidate=300" always;
}
```

```js
// sw.js - network-first for pages, cache-first only for hashed assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => { const copy = res.clone(); caches.open('pages').then((c) => c.put(request, copy)); return res; })
        .catch(() => caches.match(request).then((r) => r ?? caches.match('/offline.html')))
    );
    return;
  }
  if (new URL(request.url).pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request).then((res) => {
      const copy = res.clone(); caches.open('assets-v1').then((c) => c.put(request, copy)); return res;
    })));
  }
});
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
```

```yaml
# deploy: upload assets first, keep old ones for a few releases, then HTML, then purge
- run: aws s3 sync ./dist/assets s3://app-bucket/assets          # no --delete
- run: aws s3 cp ./dist/index.html s3://app-bucket/index.html --cache-control "no-cache"
- run: aws cloudfront create-invalidation --distribution-id $CF_ID --paths "/index.html" "/"
```

Safety net in the app for users who still hold an old page in memory:

```js
window.addEventListener('vite:preloadError', () => window.location.reload()); // Vite; in webpack catch ChunkLoadError in lazy()
```

Why it works: content-hashed assets can be cached forever because a change produces a new URL; the only file that must be fresh is the HTML that points to them, and `no-cache` makes every load check it cheaply with a `304`. Keeping old assets around means pages already open can still lazy-load their chunks. The service worker no longer pins an old shell. User data is `private`, so the CDN can never serve one user's response to another; public API data gets edge caching with background revalidation.

## How to say it in the interview

- "Hashed assets: one year, immutable. HTML: no-cache, revalidate with ETag, purge the CDN on deploy. API: private/no-store for user data, s-maxage plus stale-while-revalidate for public data. Service worker: network-first for navigations."
- "The classic post-deploy bug is a cached index.html pointing to deleted chunks - fix the HTML policy, keep old assets for a few releases, and reload on chunk-load errors."
- Trap: `no-cache` does not mean "don't cache" (that is `no-store`); it means "store but revalidate before use". Follow-up: caching personalized pages at the CDN - only with a correct cache key/`Vary`, otherwise you leak data between users.
- Trade-off: longer TTLs mean fewer requests and lower cost but slower propagation of changes; `stale-while-revalidate` gives fast responses at the price of serving slightly old data for one request.
