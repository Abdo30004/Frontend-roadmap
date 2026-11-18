# تطبيقات الويب التقدمية (PWA) والدعم دون اتصال ومزامنة البيانات

**Level:** Senior
**Merged from (original phrasings):**
- اشرح تطبيقات الويب التقدمية (PWAs) وفوائدها التقنية.
- كيف تُنفذ ميزات تطبيقات الويب التقدمية لتحسين تجربة المستخدم؟
- كيف تتعامل مع العمل دون اتصال بالإنترنت (Offline Functionality) ومزامنة البيانات؟

## The concept (short answer)

- تطبيق الـ PWA هو تطبيق ويب عادي مضاف إليه ثلاثة عناصر أساسية: اتصال آمن بـ HTTPS، و**بيان تطبيق الويب (Web App Manifest)** (الاسم، الأيقونات، وخاصية `display: standalone` لجعله قابلاً للتثبيت كأي تطبيق أصلي)، و**الـ Service Worker** (سكربت يعمل في الخلفية لاعتراض طلبات الشبكة وإدارتها).
- الفوائد: قابل للتثبيت دون الحاجة لمتاجر التطبيقات، وتحميل فوري متكرر من الكاش، والعمل بسلاسة عند ضعف الشبكة أو انقطاعها، ودعم الإشعارات اللحظية (Push Notifications)، مع كود برمجي موحد لكافة المنصات.
- التخزين المؤقت قرار يُتخذ لكل مورد على حدة: استراتيجية **Cache-first** للأصول الثابتة المجزأة، واستراتيجية **Stale-while-revalidate** للصور الرمزية (avatars) وصور المنتجات، واستراتيجية **Network-first** لبيانات الـ API ومستندات الـ HTML التي يجب أن تكون طازجة دائماً. وتمنحك مكتبة Workbox هذه الاستراتيجيات الجاهزة دون الحاجة لكتابة معالجات fetch يدوية معقدة.
- *عمليات الكتابة دون اتصال بالإنترنت (Offline Writes)* هي التحدي الأكبر. لا تُطلق طلب POST وتأمل في وصوله. بل اكتب التعديل في **قاعدة بيانات IndexedDB أولاً (صندوق الصادر Outbox)**، واعرضه تفاؤلياً في الواجهة (Optimistic UI)، وفرّغ صندوق الصادر عند عودة الاتصال (باستخدام Background Sync API حيثما كان مدعوماً، أو عبر حدث `online` مع إعادة المحاولة في بقية المتصفحات).
- تتطلب المزامنة خاصية **تحييد التأثير (Idempotency)** (معرف UUID ينشئه العميل لضمان ألا يؤدي تكرار إرسال POST إلى إنشاء طلبات مكررة) و**استراتيجية لحل النزاعات (Conflict strategy)** (مثل: فوز التعديل الأخير last-write-wins، أو أرقام الإصدارات مع رفض الخادم، أو الدمج على مستوى الحقول).

## Real-life example: the problem

تطبيق مبيعات ميداني يستخدمه المندوبون أثناء زيارة المتاجر. تقع مخازن العديد من المتاجر في طوابق سفلية تنعدم فيها إشارة الهاتف. يسجل المندوب الطلب، ويضغط "إرسال"، فيرى مؤشر تحميل يدور، ثم يتحول إلى خطأ عام مبهم، فينتقل لمتجر آخر. فضاع الطلب تماماً! والأسوأ: عند تقطع الإشارة، يصل الطلب أحياناً إلى الخادم لكن استجابة الشبكة تنقطع، فيضغط المندوب "إرسال" مجدداً، فيستلم المتجر نفس البضاعة مرتين وتصدر فاتورتان.

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

المشكلات: يعيش الطلب في الذاكرة فقط، لذا فإن إغلاق التبويب أو فشل الشبكة يمحوه كلياً. وإعادة المحاولة تُنشئ سجلات مكررة. ويقدم الـ Service worker استجابات قديمة لملف `index.html` والـ API إلى الأبد، ومع انقطاع الإنترنت قد لا يكون هيكل التطبيق مخزناً أصلاً.

## How to fix it

1. استخدام Workbox داخل الـ Service Worker باستراتيجية مخصصة لكل مسار.
2. إنشاء صندوق صادر (Outbox) دائم في IndexedDB بمعرفات يولدها العميل.
3. حلقة مزامنة تعمل عبر Background Sync أو حدث `online`.

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

في النموذج، تستدعي دالة `submit()` الآن `queueOrder(...)`، فتعرض الطلب فوراً في قائمة "في انتظار المزامنة (3)" وتفرغ حقول النموذج. ويرى المندوب شارة واضحة تفيد بالعمل دون اتصال بدلاً من رسالة خطأ.

لماذا ينجح هذا الحل:
- يُحفظ الطلب في IndexedDB قبل إجراء أي اتصال بالشبكة، فلا يضيع شيء حتى لو أُغلق التطبيق.
- يضمن معرف الـ UUID المولد من العميل مع استخدام `PUT`/`Idempotency-Key` أمان إعادة المحاولة: فيقوم الخادم بالتحديث أو الإدراج دون تكرار.
- تعود النزاعات كرمز `409` مع نسخة الخادم؛ فيحفظ التطبيق النسختين ويسأل المستخدم، أو يطبق قاعدة مثل "بيانات الخادم تحكم الأسعار، ومدخلات العميل تحكم الكميات".
- تُدار صفحات الـ HTML بـ Network-first مع مهلة زمنية قصيرة، فيحصل المستخدم على أحدث إصدار عند الاتصال، وعلى الهيكل المخزن عند الانقطاع.

البدائل: محركات المزامنة الجاهزة (مثل Replicache و PowerSync و RxDB و CouchDB/PouchDB) أو هياكل البيانات المتوافقة مع النزاعات بدون تعارض (CRDTs مثل Yjs و Automerge) عندما يُعدل عدة مستخدمين نفس السجلات دون اتصال بالإنترنت.

## How to say it in the interview

- "الـ PWA هي باختصار: ملف manifest + ومسجل service worker + واتصال HTTPS؛ وتكمن القيمة المعمارية الحقيقية في اختيار استراتيجية كاش مناسبة لكل مورد، ومعاملة عمليات الكتابة دون اتصال كصندوق صادر دائم في IndexedDB وليس كطلبات فاشلة."
- "يحصل كل تعديل غير متصل على معرف UUID من العميل لضمان تحييد التأثير (Idempotency)؛ فلا يمكن لإعادة الإرسال أن تُكرر السجلات."
- فخ المقابلة: ميزة Background Sync تعمل على متصفحات Chromium فقط، لذا يجب دائماً توفير بديل يعتمد على حدث `online` وبدء تشغيل التطبيق لمتصفحي Safari و Firefox. وانتبه إلى أن نظام iOS قد يحذف بيانات التخزين للتطبيقات غير المستخدمة؛ لذا استدعِ `navigator.storage.persist()` واحرص على إبقاء حجم صندوق الصادر صغيراً.
- المفاضلة (Trade-off): يفرض نمط Offline-first تعقيداً هندسياً حقيقياً (حل النزاعات، وترقية هياكل IndexedDB، وإدارة الكاش القديم). لذا اقتصر في دعم العمل دون اتصال على المسارات والوظائف التي يحتاجها المستخدم فعلياً في الميدان.
