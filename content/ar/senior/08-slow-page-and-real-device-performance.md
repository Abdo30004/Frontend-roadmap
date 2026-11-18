# تشخيص بطء الصفحات والأداء على الأجهزة الفعلية (Core Web Vitals)

**Level:** Senior
**Merged from (original phrasings):**
- كيف تُشخص صفحة React تستغرق 5 ثوانٍ حتى تصبح تفاعلية؟
- تطبيقك سريع على بيئة التطوير المحلية لكنه بطيء على أجهزة أندرويد الفعلية. ماذا تقيس أولاً؟
- كيف تحسن أداء الويب وتقلل أوقات التحميل؟

## The concept (short answer)

- **قِس بيانات المستخدمين الفعليين (Field data) أولاً، ثم أعد إنتاج المشكلة معملياً (Lab data).** البيانات الميدانية = RUM (مكتبة `web-vitals` التي تُرسل القياسات إلى نظام التحليلات لديك) وبيانات CrUX / Search Console. البيانات المعملية = أداة Lighthouse، ولوحة Performance في DevTools، وموقع WebPageTest. جهاز MacBook فائق السرعة عبر شبكة ألياف ضوئية يعالج JS أسرع بنحو 4-6 أضعاف مقارنة بهاتف أندرويد متوسط؛ والاختبارات المعملية دون **تقييد المعالج بنسبة (4x-6x CPU throttling)** وتقييد الشبكة تعطي نتائج مضللة تماماً.
- **مؤشرات أداء الويب الأساسية (Core Web Vitals - تُقاس عند الشريحة المئوية 75th percentile):**
  - **LCP** (Largest Contentful Paint، قياس سرعة التحميل) <= 2.5 ثانية - وتتفكك إلى: زمن أول بايت (TTFB)، وتأخير تحميل المورد، وزمن تحميل المورد، وتأخير التصيير.
  - **INP** (Interaction to Next Paint، قياس مدى الاستجابة، وقد حل رسمياً محل مقياس FID في 2024) <= 200ms - ويتألف من: تأخير الإدخال (input delay) + زمن المعالجة (processing time) + تأخير العرض (presentation delay).
  - **CLS** (Cumulative Layout Shift، قياس الثبات البصري) <= 0.1 - ويُعالج بحجز المساحات المسبقة للصور والإعلانات والخطوط.
- **"5 ثوانٍ حتى تصبح الصفحة تفاعلية" تعود دائماً تقريباً لانسداد الخيط الرئيسي بـ JavaScript:** حزم ضخمة تحتاج للتحليل والتنفيذ، أو **ترطيب (hydration)** شجرة عملاقة من المكونات على العميل، أو عمليات مكلفة في دوال التصيير وتأثيرات `useEffect`، أو سكربتات الطرف الثالث. ابحث عن **المهام الطويلة (Long tasks)** (أي مهمة تتجاوز 50ms) في لوحة الأداء؛ فأي مهمة طويلة تعطل معالجة مدخلات المستخدم فوراً.
- **الحلول بحسب الأسباب:** تقليل كود JS المشحون (Server Components، وتقسيم الكود Code Splitting)، وتقليل الترطيب (إبقاء الأجزاء الثابتة على الخادم فقط، أو بنية الجزر Islands)، وتفتيت المهام الطويلة (`scheduler.yield()`، و `setTimeout`، و transitions)، واستخدام الـ Virtualization للقوائم الطويلة، وتأجيل سكربتات الطرف الثالث، والتحميل المسبق لصورة الـ LCP، وتصيير المحتوى الحيوي في كود الـ HTML الأصلي.

## Real-life example: the problem

صفحة نتائج البحث في سوق إلكتروني للسلع المستعملة. يُسجل تقييم Lighthouse على لابتوب المطور 98 نقطة. بينما تُظهر بيانات الـ RUM الفعلية أن مؤشر INP (عند p75) يبلغ 600ms ومؤشر LCP يستغرق 4.8 ثوانٍ على هواتف أندرويد؛ حيث ينقر المستخدمون على زر "Filters" ولا يحدث أي شيء لعدة ثوانٍ، ثم تقفز عناصر الصفحة فجأة. يُظهر تتبع الأداء (Performance trace) مع تقييد المعالج 6x مهمة طويلة مدتها 3.2 ثانية عند التحميل (ترطيب 500 بطاقة سلعة + الترتيب + تنسيق التواريخ)، إلى جانب ودجت محادثة وعلامتي تحليلات تُحمّل بشكل متزامن، وصورة الـ hero الرئيسية لا يتم اكتشافها إلا بعد اكتمال تشغيل كود JavaScript.

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

أولاً، قِس الأداء في الميدان مع ربط القياس بالسبب الدقيق (Attribution) لمعرفة *أي عنصر* بالذات و*أي تفاعل* هو المتسبب في البطء:

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

ثم عالج الأسباب الجذرية: صيّر القائمة على الخادم، ورطّب المكونات التفاعلية فقط، ونفّذ العمليات الثقيلة في موضعها المناسب، وأجّل سكربتات الأطراف الخارجية.

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

وللأعمال الحوسبية التي لا مفر من تنفيذها على العميل، قم بإفساح المجال دورياً للخيط الرئيسي لمعالجة النقرات بين كل دفعة وأخرى:

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

لماذا ينجح هذا الحل: تحدد بيانات الـ RUM الميدانية مع خاصية attribution بدقة العنصر والتفاعل المتسبب؛ ويؤدي التصيير على الخادم إلى استبعاد مئات المكونات من عملية الترطيب (فيختفي شريط المهمة الطويلة البالغ 3.2 ثانية تماماً)؛ وتأتي صورة الـ LCP مباشرة في كود الـ HTML بخاصية `priority` وبأبعاد ثابتة؛ ويُحمّل ويدجت المحادثة بعد دخول المتصفح في طور الخمول؛ ويضمن تقسيم العمل في دفعات صغيرة بقاء كل مهمة تحت 50ms ليظل مؤشر INP دائماً تحت حاجز الـ 200ms.

## How to say it in the interview

- "أبدأ دائماً بالبيانات الميدانية (Field data) - قياسات RUM عبر مكتبة web-vitals مع attribution مقسمة بحسب فئات الأجهزة - لأن البيئات المعملية على أجهزة المطورين تُخفي العبء الحقيقي على المعالج. بعد ذلك أعيد إنتاج المشكلة مع تقييد المعالج (CPU throttling) وفحص المهام الطويلة في لوحة Performance."
- "مؤشر LCP هو مشكلة تحميل (سرعة الخادم، والمسار الحرج، وأولوية الصور)، ومؤشر INP هو مشكلة ازدحام الخيط الرئيسي (مهام طويلة، وترطيب ضخم، ومعالجات أحداث ثقيلة)، ومؤشر CLS هو مشكلة حجز مساحات للعناصر."
- فخ المقابلة: تحسين أرقام Lighthouse الاصطناعية وتجاهل شريحة p75 في البيانات الميدانية الحقيقية؛ وتذكر أن مقياس "TTI" لم يعد ضمن Core Web Vitals - بل تحدث عن INP و Total Blocking Time. سؤال متابعة: كيفية كشف التفاعلات البطيئة - باستخدام INP attribution و Long Animation Frames API (LoAF).
- المفاضلة (Trade-off): نقل العمليات إلى الخادم يُقلل العبء على معالج العميل لكنه قد يرفع زمن استجابة الخادم الأول (TTFB) وتكاليف الاستضافة؛ واستخدم التدفق عبر Suspense لضمان بقاء الـ TTFB منخفضاً وسريعاً.
