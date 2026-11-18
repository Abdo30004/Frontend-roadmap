# المراقبة وتتبع الأخطاء (Monitoring & Error Tracking) لتطبيقات الإنتاج

**Level:** Senior
**Merged from (original phrasings):**
- كيف تضبط نظام المراقبة وتتبع الأخطاء لتطبيقات الواجهة الأمامية في بيئة الإنتاج؟

## The concept (short answer)

- ثلاثة محاور متكاملة: **تتبع الأخطاء (Error Tracking)** (الاستثناءات غير المعالجة، والوعود المرفوضة unhandled rejections، وحدود أخطاء React Error Boundaries، وفشل طلبات الـ API) باستخدام أدوات مثل Sentry أو Bugsnag أو Datadog RUM؛ و**مراقبة أداء المستخدمين الفعليين (RUM)** (مؤشرات Core Web Vitals: LCP و INP و CLS بالإضافة لـ TTFB) عبر مكتبة `web-vitals`؛ و**التنبيهات الذكية (Alerting)** بناءً على معدلات الخطأ وليس على كل خطأ فردي.
- تتبع المكدس المضغوط (Minified Stack Trace) عديم الفائدة تماماً، لذا **ارفع خرائط المصادر (Source Maps)** إلى أداة تتبع الأخطاء أثناء خطوة الـ CI، ولكن **لا تنشرها علناً على الـ CDN أبداً** (أنتج خرائط مخفية `hidden` ثم احذفها من مجلد النشر النهائي).
- أرفق وسم **الإصدار (Release)** (عبر git SHA) و**البيئة (Environment)** مع كل حدث، لتتمكن من القول بدقة "قفز معدل الأخطاء في الإصدار `a1b2c3d`" وربطها بعمليات النشر، ووضع علامة "تم الحل في الإصدار القادم".
- أرفق السياق الحيوي: معرّف المستخدم (مع استبعاد بيانات الهوية الشخصية PII)، والمسار، وأعلام الميزات، و**مسار التتبع (Breadcrumbs)** (النقرات، والتنقلات، وطلبات الشبكة التي سبقت وقوع الخطأ مباشرة).
- **تصفية الضوضاء (Filter noise):** استبعد أخطاء إضافات المتصفح، وتحذيرات `ResizeObserver loop`، والروبوتات، والطلبات الملغاة، وسكربتات الطرف الثالث. وإلا ستغرق الإشارات الحقيقية ويتوقف الفريق عن النظر في التنبيهات.
- التنبيه على ما يهم الأعمال: تراجع نسبة الجلسات الخالية من الأعطال (Crash-free sessions)، وارتفاع معدل أخطاء إصدار جديد عن المعدل الأساسي، وتراجع أداء p75 لـ LCP/INP، مع توجيه التنبيه مباشرة للفريق المسؤول.

## Real-life example: the problem

تعطلت إحدى طرق الدفع في صفحة إتمام الشراء لتطبيق توصيل وجبات لمدة 6 ساعات كاملة يوم السبت. لم يتلق أي مهندس تنبيهاً على الإطلاق؛ واكتشف الفريق الكارثة من التقييمات الغاضبة على المتجر! وعندما فحصوا أداة الأخطاء، وجدوا 50,000 "قضية" يومياً (معظمها أخطاء ناتجة عن إضافات المتصفح لدى المستخدمين)، وأسطر التتبع تُشير لرموز مبهمة مثل `main.3f9a.js:1:84213`، ولم يستطع أحد تحديد أي نشر تسبب في المشكلة، وكانت ملفات الـ Source Maps متاحة للتنزيل المباشر على الـ CDN العام كاشفة كامل الكود المصدري وتعليقات الـ API الداخلية للمنافسين.

```js
// vite.config.js - BROKEN
export default defineConfig({
  build: { sourcemap: true },              // .map files deployed publicly to the CDN
});
```

```tsx
// main.tsx - BROKEN
Sentry.init({
  dsn: 'https://public@o0.ingest.sentry.io/0',
  // no release, no environment, no filtering, 100% traces in prod
  tracesSampleRate: 1.0,
});

// errors inside React render are swallowed by the default white screen,
// and fetch failures (HTTP 500) never throw, so they are never reported
const res = await fetch('/api/pay', { method: 'POST', body });
const data = await res.json();
```

## How to fix it

```js
// vite.config.js
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  build: { sourcemap: 'hidden' },                       // maps generated, no sourceMappingURL comment
  plugins: [
    react(),
    sentryVitePlugin({
      org: 'acme', project: 'web',
      authToken: process.env.SENTRY_AUTH_TOKEN,         // CI secret
      release: { name: process.env.GIT_SHA },
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },   // never deployed
    }),
  ],
});
```

```tsx
// monitoring.ts
import * as Sentry from '@sentry/react';
import { onLCP, onINP, onCLS, type Metric } from 'web-vitals';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  release: import.meta.env.VITE_GIT_SHA,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,                               // sample performance traces
  replaysOnErrorSampleRate: 1.0,                       // session replay only around errors
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration({ maskAllText: true })],
  allowUrls: [/https:\/\/(www|static)\.fooddelivery\.example/],   // drop extension/3rd-party noise
  ignoreErrors: ['ResizeObserver loop limit exceeded', 'AbortError', /^Non-Error promise rejection/],
  beforeSend(event) {
    if (event.user) delete event.user.email;           // no PII
    return event;
  },
});

function sendVital(m: Metric) {
  navigator.sendBeacon('/rum', JSON.stringify({
    name: m.name, value: m.value, rating: m.rating,
    route: location.pathname, release: import.meta.env.VITE_GIT_SHA,
  }));
}
onLCP(sendVital); onINP(sendVital); onCLS(sendVital);
```

```tsx
// App.tsx - catch render errors, report HTTP failures explicitly
<Sentry.ErrorBoundary fallback={<CheckoutError />} beforeCapture={(s) => s.setTag('area', 'checkout')}>
  <Checkout />
</Sentry.ErrorBoundary>

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  Sentry.addBreadcrumb({ category: 'api', message: `${init?.method ?? 'GET'} ${url}` });
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = new Error(`API ${res.status} ${url}`);
    Sentry.captureException(err, { tags: { endpoint: url, status: res.status } });
    throw err;
  }
  return res.json();
}
```

التنبيهات (Alerting - تُضبط في الأداة وتُوزع على الفرق):
- ظهور قضية جديدة في أحدث نشر تؤثر على أكثر من 50 مستخدماً خلال 10 دقائق: تنبيه فوري لمهندس الطوارئ المناوب (On-call) لتلك المنطقة.
- هبوط نسبة الجلسات الخالية من الأعطال تحت 99.5% أو قفزة أخطاء الدفع إلى 3 أضعاف المعدل المعتاد: تنبيه طوارئ فوري.
- تراجع مؤشر p75 لـ INP أو LCP بأكثر من 20% بعد النشر: إشعار على Slack، دون إطلاق جرس الطوارئ.

لماذا ينجح هذا الحل: تمنح خرائط المصادر المخفية تتبعاً برمجياً واضحاً ومقروءاً دون تسريب الكود للعامة؛ وتربط وسوم الإصدارات كل طفرة أخطاء بعملية نشر محددة (مما يُسهل قرارات التراجع الفوري)؛ وتجعل التصفية الذكية قائمة الأخطاء نقية وصغيرة بما يكفي ليتابعها الفريق؛ وتُنبه القواعد المبنية على المعدلات مهندسي الطوارئ خلال دقائق بدلاً من انتظار غضب المستخدمين.

## How to say it in the interview

- "أراقب ثلاثة محاور رئيسية: أخطاء التطبيق، وأداء المستخدمين الفعليين RUM، ومؤشرات صحة الأعمال الحيوية كمعدل إتمام الدفع، مع وسم كل حدث بالإصدار والبيئة."
- "تُرفع خرائط المصادر Source Maps في الـ CI مباشرة إلى نظام تتبع الأخطاء وتُحذف فوراً من مجلد النشر؛ ولا تُعرض أبداً في بيئة الإنتاج."
- فخ المقابلة: استدعاء `fetch` لا يرمي أخطاء عند استلام رموز 4xx/5xx، كما أن React تبتلع أخطاء التصيير ما لم تُحط بـ Error Boundaries؛ لذا يجب التقاط كلاهما صراحة وبشكل مقصود.
- المفاضلة (Trade-off): تسجيل كل البيانات يستهلك ميزانيات ضخمة ويشتت انتباه المهندسين. خذ عينات إحصائية من التتبعات والتسجيلات (Sampling)، وصفّ الضوضاء بحزم، واجعل التنبيهات مبنية على المعدلات وتأثير المستخدم وليس على كل استثناء فردي.
