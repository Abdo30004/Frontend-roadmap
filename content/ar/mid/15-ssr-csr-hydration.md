# المقارنة بين SSR و CSR والـ Hydration (مع SSG/ISR): ما الفروق ومتى تستخدم كلاً منها؟

**Level:** Mid
**Merged from (original phrasings):**
- اشرح التصيير على جانب الخادم (SSR) والتصيير على جانب العميل (CSR).‏
- المقارنة بين SSR و CSR والـ Hydration: ما الفروق بينها ومتى تستخدم كلاً منها؟
- اشرح مفهوم الـ Server-Side Rendering في Next.js.‏
- كيف تطبق التصيير على جانب الخادم مع الـ Hydration للتطبيقات المعقدة؟

## The concept
- **التصيير على جانب العميل (CSR - Client-Side Rendering)**: يرسل الخادم هيكل HTML فارغاً تقريباً مع حزمة جافاسكريبت، فيقوم المتصفح بجلب البيانات وبناء شجرة الـ DOM. يرى المستخدم شاشة بيضاء أو مؤشر تحميل حتى يكتمل تنفيذ الجافاسكريبت، ويكون تحسين محركات البحث (SEO) والمعاينات الاجتماعية أضعف. يناسب لوحات التحكم المحمية بتسجيل دخول والتطبيقات فائقة التفاعل.
- **التصيير على جانب الخادم (SSR - Server-Side Rendering)**: يشغل الخادم مكونات React مع كل طلب ويرسل HTML مكتملاً للمتصفح. يمنحك ظهوراً بصرياً أولياً فائق السرعة (FCP/LCP)، ومحتوى مهيأ تماماً للـ SEO، وبيانات مخصصة حسب الطلب (مثل المصادقة). وتكلفته زيادة استهلاك معالج الخادم وزيادة محتملة في زمن أول بايت (TTFB) إذا تأخرت استدعاءات البيانات.
- **التوليد الثابت وإعادة التوليد (SSG / ISR)**: يُصيّر الـ HTML وقت البناء (SSG)، أو يُصيّر ثم يُعاد تحديثه في الخلفية بعد N ثانية أو حسب الطلب (ISR). تُخدم الصفحات مباشرة من شبكات التوزيع (CDN) بأعلى سرعة ممكنة. وهو مثالي لصفحات التسويق، والمدونات، وتفاصيل المنتجات.
- **عملية الـ Hydration**: كود الـ HTML القادم من الـ SSR هو محتوى بصري ثابت غير تفاعلي. يقوم المتصفح بتحميل نفس حزمة الجافاسكريبت، ويعيد React تصيير المكونات في الذاكرة لربط مستمعي الأحداث (Event listeners) بعقد الـ DOM الموجودة بالفعل بدلاً من إعادة إنشائها من الصفر. ويشترط هذا أن يتطابق أول تصيير للعميل تماماً مع مخرجات الخادم، وإلا حدث خطأ **عدم تطابق الـ Hydration (Hydration mismatch)**.
- **في Next.js App Router**: تكون كافة المكونات افتراضياً مكونات خادم (Server Components) ولا يُشحن كود الجافاسكريبت الخاص بها للعميل. ويمثل سطر `'use client'` جزراً تفاعلية تُجرى لها عملية الـ Hydration. ويكون المسار ثابتاً أو ديناميكياً بحسب الدوال المستخدمة فيه (`cookies()`، أو `headers()`، أو طلبات fetch غير المخزنة مؤقتاً).‏
- **التطبيقات المعقدة**: تعتمد على **الـ Streaming SSR مع Suspense** لإرسال الهيكل العام فوراً وتدفق الأقسام البطيئة تدريجياً، مع **الـ Selective Hydration** (حيث يقوم React بإجراء الـ hydration للأجزاء التي يتفاعل معها المستخدم أولاً).‏

## Real-life example
في موقع لحجز تذاكر الطيران، تُصيّر صفحة نتائج البحث على جانب الخادم (SSR). في بيئة الإنتاج، لاحظ المستخدمون في المناطق الزمنية المختلفة أن توقيت "وقت الإقلاع" يومض ويقفز من قيمة لأخرى لحظة اكتمال التحميل. وسجل نظام تتبع الأخطاء Sentry تحذيراً: `Hydration failed because the server rendered text didn't match the client`، وأحياناً تفقد لافتة العروض الترويجية استجابتها للنقر. السبب: اختلاف المنطقة الزمنية بين الخادم (UTC) والمتصفح (توقيت المستخدم)، وقراءة قيم `window` أو `localStorage` أثناء عملية التصيير الأولى.

```jsx
'use client';

export function FlightCard({ flight }) {
  // الخادم (UTC): يظهر "08:00". المتصفح (UTC+2): يظهر "10:00" -> يحدث خطأ Mismatch!
  const departs = new Date(flight.departureIso).toLocaleTimeString();

  // على الخادم: window غير معرف (false). على العميل: قد يكون true -> اختلاف كود الـ HTML!
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

يعجز React عن مطابقة الـ HTML المستلم. وفي الإصدارات السابقة كان يلغي الشجرة الفرعية ويعيد بناءها على العميل (مما يسبب قفزة مرئية واستهلاكاً للوقت)، بينما في React 19 يسجل الخطأ ويعالج الموقف بإعادة تصيير المكون على العميل حتى أقرب حدود Suspense. وفي الحالتين يفقد المستخدم مزايا الـ SSR.‏

## How to fix it
```jsx
'use client';
import { useEffect, useState } from 'react';

export function FlightCard({ flight }) {
  // 1. تنسيق محدد وحتمي: لغة ثابتة مع المنطقة الزمنية لمطار المغادرة (مرسلة من الخادم)
  const departs = new Intl.DateTimeFormat('ar-SA', {
    hour: '2-digit', minute: '2-digit', timeZone: flight.originTimeZone,
  }).format(new Date(flight.departureIso));

  // 2. قراءة خصائص المتصفح بعد اكتمال الـ Hydration، داخل useEffect
  const [isReturning, setIsReturning] = useState(false); // نفس القيمة الابتدائية على الخادم والعميل
  useEffect(() => {
    setIsReturning(localStorage.getItem('seenPromo') === '1');
  }, []);

  return (
    <article>
      <h3>{flight.route}</h3>
      <p>وقت الإقلاع: <time dateTime={flight.departureIso}>{departs}</time></p>
      {!isReturning && <PromoBanner />}
    </article>
  );
}
```

ولدعم تدفق الأجزاء البطيئة دون حجب الاستجابة بالكامل:

```jsx
// app/search/page.jsx (Server Component)
import { Suspense } from 'react';

export default async function SearchPage({ searchParams }) {
  const { from, to } = await searchParams; // في Next.js 15: searchParams هو Promise
  return (
    <>
      <SearchForm from={from} to={to} />                 {/* يُرسل فوراً دون أي انتظار */}
      <Suspense fallback={<ResultsSkeleton />}>
        <FlightResults from={from} to={to} />            {/* يتدفق فور اكتمال رد الـ API */}
      </Suspense>
    </>
  );
}
```
سبب نجاح الحل: ينتج أول تصيير على العميل نفس كود الـ HTML الصادر من الخادم حرفياً، فتكتفي عملية الـ Hydration بربط مستمعي الأحداث بسرعة وسلاسة. وتُطبق القيم المعتمدة على المتصفح في دورة تصيير ثانية بعد التركيب. كما يضمن الـ Streaming عدم تأخير الـ TTFB للصفحة بسبب واجهة برمجة بطيئة.

بدائل أخرى: استخدام `suppressHydrationWarning` لعنصر محدد يختلف نصه بشكل مبرر مثل التوقيت اللحظي؛ أو استخدام `next/dynamic` مع `{ ssr: false }` للمكونات التي تعتمد حصرياً على واجهات المتصفح (كالخرائط والرسوم البيانية).‏

## How to say it in the interview
- "الـ SSR يمنحك كود الـ HTML بسرعة للظهور الفوري، والـ Hydration تضفي عليه الحيوية والتفاعل، والشرط الصارم بينهما هو أن يتطابق أول تصيير للعميل تماماً مع مخرجات الخادم."
- "أختار النمط المناسب لكل مسار: SSG/ISR للمحتوى الموحد للجميع، و SSR أو Streaming للبيانات الشخصية الحية، و CSR للشاشات التفاعلية الداخلية بعد تسجيل الدخول."
- فخ شائع: الاعتقاد بأن "الـ SSR يجعل الصفحة أسرع في التفاعل". هو يسرع مؤشرات FCP و LCP فقط، أما زمن التفاعل (TTI) فيعتمد على حجم الجافاسكريبت. فقد تبدو الصفحة جاهزة بصرياً ولكنها تتجاهل نقرات المستخدم حتى تنتهي عملية الـ Hydration (الفجوة المخادعة Uncanny Valley).‏
- أسباب أخطاء الـ Mismatch الشائعة: استدعاء `Date` أو `Math.random()` أثناء التصيير، وفحص `window`/`localStorage` في جسم الدالة، وتداخل وسوم HTML غير الصالحة (مثل وضع `<div>` داخل `<p>`)، وإضافات المتصفح التي تعدل الـ DOM.‏
