# توزيع التخزين المؤقت (Caching) بين المتصفح و الـ CDN و Service Worker وطبقة الـ API

**Level:** Senior
**Merged from (original phrasings):**
- كيف توزع التخزين المؤقت (Caching) بين المتصفح و CDN و Service Worker وطبقة الـ API؟

## The concept (short answer)

تُخزن كل طبقة نوعاً مختلفاً من البيانات، وتُعد ترويسة `Cache-Control` هي العقد الصريح المُنظم بين هذه الطبقات:

- **الأصول الثابتة المجزأة (Hashed static assets):** مثل (`app.3f9a1c.js`، والخطوط، والصور التي تحتوي أسماؤها على تجزئة المحتوى Content Hash): ترويستها هي `Cache-Control: public, max-age=31536000, immutable`. يتغير الرابط URL تلقائياً بمجرد تغير المحتوى، لذا فإن تخزينها "إلى الأبد" (لمدة عام) في المتصفح وشبكة الـ CDN يُعد آمناً تماماً.
- **مستندات HTML / ملف `index.html`:** (نقطة الدخول الرئيسية التي تُشير إلى ملفات الـ JS المجزأة): يجب ضبطها على `no-cache` للمتصفح (بمعنى: خزّن الملف، ولكن **تحقق من الصلاحية revalidate** في كل زيارة عبر ETag -> للحصول على رد `304` خفيف وسريع). أما على مستوى الـ CDN، إما ضبطها على `no-cache` أيضاً، أو تعيين `s-maxage=60, stale-while-revalidate=...` **مع اشتراط تفريغ كاش الـ CDN (Purge) فورياً عند كل نشر**. لا تضع أبداً مدة `max-age` طويلة على ملفات الـ HTML إطلاقاً.
- **توجيهات خاصة بشبكات الـ CDN:** التوجيه `s-maxage` ينطبق حصرياً على الكاش المشترك (CDN/Proxy) ويتجاوز قيمة `max-age` هناك؛ والتوجيه `stale-while-revalidate=N` يُقدّم النسخة القديمة من الكاش فورياً بينما يجلب نسخة حديثة في الخلفية؛ وتُحدد ترويسة `Vary` أي ترويسات طلب تُغير محتوى الاستجابة (مثل `Accept-Encoding`، وأحياناً `Accept-Language`).
- **استجابات الـ API:** بيانات المستخدم الخاصة -> `private, no-store` (أو `private, no-cache`) لضمان عدم قيام أي CDN بتخزينها مطلقاً؛ أما البيانات العامة المشتركة (كتالوج المنتجات، أسعار الصرف) -> فتُضبط على `public, s-maxage=60, stale-while-revalidate=300` عند أطراف الشبكة (Edge).
- **الـ Service Worker:** مخصص للدعم دون اتصال بالإنترنت وتسريع التحميل المتكرر فورياً. استراتيجية **Cache-first** للأصول المجزأة الثابتة، واستراتيجية **Network-first** لصفحات التنقل ومستندات الـ HTML، واستراتيجية Network-first أو Stale-while-revalidate لطلبات API محددة. إنه كاش برمجي يتجاهل قواعد HTTP ما لم تبرمجها بنفسك - وتنشأ معظم أخطاء "التطبيق العالق على نسخة قديمة للأبد" من هنا.
- **كاش الاستعلامات للعميل (TanStack Query/SWR/RTK Query):** يعيش في الذاكرة (in-memory) لكل جلسة، لمنع تكرار الطلبات وتوفير واجهة مستخدم فورية؛ ويُضبط عبر `staleTime` وتُبطل صلاحيته بواسطة التعديلات (mutations). إنه مكمل لكاش HTTP وليس بديلاً عنه.

## Real-life example: the problem

حالة كلاسيكية شهيرة: تطبيق لحجز رحلات ينشر إصداراً جديداً في الساعة 10:00. ومن الساعة 10:00 حتى 11:00 يواجه قطاع من المستخدمين شاشة بيضاء فارغة مع خطأ `ChunkLoadError: Loading chunk 482 failed` في Sentry. بينما يستمر مستخدمون آخرون في تشغيل إصدار الأسبوع الماضي الذي يحتوي على خطأ تسعير معروف، حتى بعد قيامهم بتحديث الصفحة. الأسباب الجذرية:

1. ملف `index.html` مخزن مؤقتاً في الـ CDN والمتصفحات لمدة ساعة كاملة، لذلك لا يزال يُشير إلى الملف `chunk-482.a1b2.js`، الذي حذفته عملية النشر الجديدة من حاوية التخزين (S3 bucket).
2. يقدم الـ Service worker ملف `index.html` باستراتيجية Cache-first ويُحدّث في الخلفية فقط - ويظل الـ SW الجديد معلقاً في حالة الانتظار "waiting" حتى تُغلق جميع التبويبات المفتوحة.

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

شبكة أمان داخل التطبيق للمستخدمين الذين لا يزالون يحتفظون بنسخة قديمة في الذاكرة:

```js
window.addEventListener('vite:preloadError', () => window.location.reload()); // Vite; in webpack catch ChunkLoadError in lazy()
```

لماذا ينجح هذا الحل: الأصول ذات الأسماء المعتمدة على تجزئة المحتوى (Content hash) يمكن تخزينها للأبد لأن أي تعديل سينتج رابطاً جديداً بالضرورة؛ والملف الوحيد الذي يجب أن يكون طازجاً دائماً هو كود الـ HTML الذي يُشير إليها، وتوجيه `no-cache` يجعله يتحقق من الخادم برمز `304` خفيف. كما أن الاحتفاظ بالأصول القديمة لعدة إصدارات سابقة يتيح للصفحات المفتوحة بالفعل إمكانية تحميل أجزائها الكسولة (lazy chunks) بنجاح. ويتوقف الـ Service worker عن تثبيت هيكل قديم. وتُصنف بيانات المستخدم بـ `private` حتى لا يُسلّم الـ CDN استجابة مستخدم إلى مستخدم آخر؛ بينما تنال بيانات الـ API العامة كاشاً عند أطراف الشبكة مع إعادة تحديث في الخلفية.

## How to say it in the interview

- "الأصول ذات الـ Hash: عام كامل مع immutable. مستندات HTML: توجيه no-cache والتحقق عبر ETag مع تفريغ الـ CDN عند كل نشر. واجهات الـ API: توجيه private/no-store لبيانات المستخدمين، وتوجيه s-maxage مع stale-while-revalidate للبيانات العامة. والـ Service Worker: استراتيجية Network-first لصفحات التنقل."
- "الخطأ الشهير بعد النشر هو بقاء index.html قديماً في الكاش يُشير إلى أجزاء JS محذوفة - والحل هو ضبط سياسة الـ HTML بشكل صحيح، والاحتفاظ بالأصول القديمة لعدة إصدارات سابقة، وإعادة تحميل الصفحة تلقائياً عند فشل تحميل الـ Chunk."
- فخ المقابلة: توجيه `no-cache` لا يعني "عدم التخزين" (ذلك هو `no-store`)؛ بل يعني "خزّن ولكن تحقق من الصلاحية مع الخادم قبل الاستخدام". سؤال متابعة: تخزين الصفحات المخصصة في الـ CDN - لا يتم إلا باستخدام مفتاح كاش دقيق أو ترويسة `Vary` مناسبة، وإلا ستتسرب بيانات المستخدمين لبعضهم البعض.
- المفاضلة (Trade-off): الفترات الزمنية الأطول (TTL) تعني طلبات أقل وتكلفة خوادم أدنى ولكن انتشاراً أبطأ للتحديثات؛ بينما تمنح استراتيجية `stale-while-revalidate` استجابة فائقة السرعة مقابل تقديم بيانات قديمة قليلاً لطلب واحد مؤقت.
