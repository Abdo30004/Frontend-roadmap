# Progressive Web Apps, Offline Support and Data Synchronization

**Level:** Senior
**Merged from (original phrasings):**
- Explain Progressive Web Apps (PWAs) and their benefits.
- How do you implement progressive web app features for better user experience?
- How do you handle offline functionality and data synchronization?

## The concept (short answer)
- A PWA is a normal web app plus three things: HTTPS, a **web app manifest** (name, icons, `display: standalone`, so it is installable) and a **service worker** (a background script that intercepts network requests).
- Benefits: installable without an app store, fast repeat loads from cache, works on flaky or no network, push notifications, one codebase for all platforms.
- Caching is a per-resource decision: **cache-first** for hashed static assets, **stale-while-revalidate** for things like avatars or product images, **network-first** for API data and HTML that must be fresh. Workbox gives you these strategies without hand-writing fetch handlers.
- Offline *writes* are the hard part. Never fire a POST and hope. Write the change to **IndexedDB first (an outbox)**, show it optimistically in the UI, and drain the outbox when the network returns (Background Sync API where supported, `online` event + retry everywhere else).
- Sync needs **idempotency** (a client-generated ID so a retried POST does not create duplicates) and a **conflict strategy** (last-write-wins, version numbers with server rejection, or field-level merge).

## Real-life example: the problem
A field-sales app is used by reps visiting shops. Many shops have stock rooms in basements with no signal. Reps take an order, press "Submit", see a spinner, the spinner turns into a generic error, and they move on. The order is gone. Worse: when the signal flickers, the request sometimes reaches the server but the response is lost, the rep taps "Submit" again, and the shop receives the order twice.

```tsx
// OrderForm.tsx - BROKEN: online-only, not idempotent
export function OrderForm({ shopId }: { shopId: string }) {
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  async function submit() {
    setStatus('saving');
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, lines }),   // no client ID
      });
      setLines([]);
      setStatus('idle');
    } catch {
      setStatus('error');                           // order lives only in React state
    }
  }
  // ...
}
```

```js
// sw.js - BROKEN: cache everything forever
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  );
});
```

Problems: the order exists only in memory, so closing the tab or a failed request loses it. Retries create duplicates. The service worker serves stale API responses and stale `index.html` forever (users stuck on an old release), and with no network the app shell may not even be cached.

## How to fix it
1. A Workbox service worker with a strategy per route.
2. An IndexedDB outbox with client-generated IDs.
3. A sync loop triggered by Background Sync or the `online` event.

```js
// sw.js (built with workbox-build / vite-plugin-pwa injectManifest)
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

precacheAndRoute(self.__WB_MANIFEST);                     // hashed JS/CSS + app shell

registerRoute(new NavigationRoute(
  new NetworkFirst({ cacheName: 'pages', networkTimeoutSeconds: 3 })
));
registerRoute(({ url }) => url.pathname.startsWith('/api/catalog'),
  new StaleWhileRevalidate({ cacheName: 'catalog' }));    // products can be slightly stale

self.addEventListener('sync', (event) => {
  if (event.tag === 'flush-outbox') event.waitUntil(flushOutbox());
});
```

```ts
// outbox.ts - shared by the page and the service worker
import { openDB } from 'idb';

const db = openDB('sales', 1, {
  upgrade(d) { d.createObjectStore('outbox', { keyPath: 'id' }); },
});

export async function queueOrder(order: Omit<Order, 'id'>) {
  const entry = { ...order, id: crypto.randomUUID(), createdAt: Date.now(), version: 1 };
  await (await db).put('outbox', entry);                  // durable before anything else
  const reg = await navigator.serviceWorker.ready;
  if ('sync' in reg) await reg.sync.register('flush-outbox');
  else flushOutbox();                                     // Safari/Firefox fallback
  return entry;
}

export async function flushOutbox() {
  const all = await (await db).getAll('outbox');
  for (const entry of all) {
    const res = await fetch('/api/orders', {
      method: 'PUT',                                      // idempotent upsert by id
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': entry.id },
      body: JSON.stringify(entry),
    });
    if (res.ok || res.status === 409) {                   // 409 = conflict, handled below
      if (res.status === 409) await saveConflict(entry, await res.json());
      await (await db).delete('outbox', entry.id);
    } else {
      throw new Error('retry later');                     // Background Sync will retry
    }
  }
}

if (typeof window !== 'undefined') window.addEventListener('online', () => flushOutbox());
```

In the form, `submit()` now calls `queueOrder(...)`, immediately shows the order in a "Pending sync (3)" list, and clears the form. The rep sees a clear offline badge instead of an error.

Why it works:
- The order is written to IndexedDB before any network call, so nothing is lost when the tab closes.
- The client-generated `id` + `PUT`/`Idempotency-Key` makes retries safe: the server upserts, no duplicate orders.
- Conflicts (e.g. a back-office user edited the same order) come back as `409` with the server version; the app stores both and asks the rep, or applies a rule such as "server wins for prices, client wins for quantities".
- HTML is network-first with a timeout, so users get new releases when online and the cached shell when not.

Alternatives: a sync engine (Replicache, PowerSync, RxDB, CouchDB/PouchDB) or CRDTs (Yjs, Automerge) when many users edit the same data offline.

## How to say it in the interview
- "A PWA is manifest + service worker + HTTPS; the real value is choosing a caching strategy per resource and treating offline writes as a durable outbox in IndexedDB, not as failed requests."
- "Every offline write gets a client UUID so the sync is idempotent; retries can never double-submit."
- Trap: Background Sync is Chromium-only, so always have an `online`/app-start fallback. Also iOS may evict storage for unused PWAs; call `navigator.storage.persist()` and keep the outbox small.
- Trade-off: offline-first adds real complexity (conflicts, schema migrations of IndexedDB, stale caches). Only make the flows offline-capable that users actually need offline.
