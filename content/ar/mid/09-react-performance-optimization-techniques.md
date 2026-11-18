# ما هي التقنيات التي تستخدمها لتحسين أداء تطبيقات React؟

**Level:** Mid
**Merged from (original phrasings):**
- ما هي تقنيات تحسين أداء React المختلفة؟
- كيف تحسن أداء تطبيق مبني بـ React؟
- كيف تجعل تطبيقات React سريعة وعالية الأداء؟

## The concept
ابدأ دائماً **بالقياس** (استخدم Lighthouse ومؤشرات أداء الويب الأساسية Core Web Vitals لسرعة التحميل، وأداة React DevTools Profiler ولوحة Performance في المتصفح لأداء وقت التشغيل). ثم اختر التقنية المناسبة للاختناق الفعلي (Bottleneck):‏

| المشكلة | التقنية المناسبة |
|---|---|
| مكونات يُعاد تصييرها دون داعٍ | حصر الحالة (State colocation)، واستخدام `memo` مع `useMemo` و `useCallback`، أو مترجم React Compiler |
| عمليات حسابية معقدة ومكلفة مع كل تصيير | استخدام `useMemo`، أو نقل المعالجة إلى الخادم أو إلى Web Worker |
| حزمة جافاسكريبت ضخمة وبطء أول تحميل | تقسيم الكود (Code splitting) عبر `React.lazy` والـ `import()` الديناميكي وتقسيم المسارات |
| قوائم طويلة وجداول ضخمة تسبب ثقلاً | محاكاة العرض (Virtualization) عبر `@tanstack/react-virtual` أو `react-window` لتصيير العناصر المرئية فقط |
| تأخر وبطء استجابة الكتابة أثناء تحديث القوائم | استخدام `useTransition` أو `useDeferredValue` لجعل العمليات الثقيلة غير عاجلة وقابلة للمقاطعة |
| تحديث الـ Context يعيد تصيير التطبيق كاملاً | تقسيم الـ Contexts، أو تحفيظ القيمة الممررة، أو استخدام متجر يعتمد على الـ Selectors (مثل Zustand) |
| بطء مؤشر LCP وتغير أبعاد الصفحة (CLS) | تحسين الصور: استخدام `next/image`، وتوفير أحجام صريحة، و `loading="lazy"`، و `fetchpriority="high"` لصورة البداية |
| تتابع طلبات الشبكة البطيء (Request Waterfalls) | جلب البيانات من الخادم (RSC)، وتنفيذ الطلبات بالتوازي، والتخزين المؤقت عبر TanStack Query |

ملاحظات موجزة:
- **التحفيظ (Memoization)**: لا يفيد إلا عندما تكون الخصائص مستقرة والعملية التي تم تخطيها ثقيلة ومكلفة حقاً. تجنب تغليف كل شيء بلا هدف.
- **حصر وتوطين الحالة (State colocation)**: احتفظ بالحالة في أدنى مكون يحتاجها في الشجرة؛ فالتحديثات المتكررة حينها ستعيد تصيير شجرة فرعية صغيرة جداً.
- **تقسيم الكود (Code splitting)**: لا ترسل للمتصفح إلا كود المسار الحالي فقط؛ وحمّل العناصر الثقيلة (المحررات، والخرائط، والرسوم البيانية) عند الحاجة إليها فقط.
- **محاكاة العرض (Virtualization)**: وجود 10,000 عقدة في الـ DOM سيجعل الصفحة بطيئة مهما بالغت في استخدام memo. صيّر حوالي 30 عنصراً مرئياً فقط.
- **الانتقالات المتزامنة (Transitions)**: حافظ على سرعة استجابة مدخلات المستخدم بالسماح لـ React بمقاطعة عمليات التصيير غير العاجلة.
- **الصور**: تمثل عادة الحجم الأكبر على الإطلاق في الصفحة وهي العنصر الأكثر تأثيراً على مقياس LCP.‏

## Real-life example
موقع لعقارات وإيجارات: تستغرق صفحة البحث 6 ثوانٍ للتحميل على أجهزة الجوال (LCP 5.8s)، والكتابة في فلتر "المدينة" تجمد الشاشة لحظياً مع كل حرف يُكتب. هذا سيناريو واقعي مألوف: يلاحظ الفريق مؤشرات سيئة في Google Search Console دون معرفة نقطة البداية.

```jsx
import { MapView } from './MapView'; // مكتبة خرائط ضخمة (~400KB)، تُحمل في كل الصفحات

export default function SearchPage({ listings }) { // 3,000 عقار
  const [city, setCity] = useState('');
  const filtered = listings.filter((l) => l.city.toLowerCase().includes(city.toLowerCase()));

  return (
    <>
      <img src="/hero-4000px.jpg" />                    {/* صورة بحجم 2.5MB دون أبعاد أو أولوية */}
      <input value={city} onChange={(e) => setCity(e.target.value)} />
      <MapView listings={filtered} />
      <ul>
        {filtered.map((l) => <ListingCard key={l.id} listing={l} />)} {/* 3,000 عنصر في الـ DOM */}
      </ul>
    </>
  );
}
```
نتائج فحص الـ Profiler و Lighthouse: الصورة الرئيسية هي المتسببة في بطء LCP، ومكتبة الخرائط تسد حزمة البداية (Main bundle)، وكل ضربة زر تعيد تصيير 3,000 بطاقة عقار بالإضافة إلى إعادة تصيير الخريطة.

## How to fix it
```jsx
'use client'; // في Next.js App Router: هذا القسم يستخدم الحالة والخطافات

import { lazy, Suspense, useDeferredValue, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useVirtualizer } from '@tanstack/react-virtual';

const MapView = lazy(() => import('./MapView')); // حزمة منفصلة، تُحمل فقط عند الحاجة لتصييرها

export default function SearchPage({ listings }) {
  const [city, setCity] = useState('');
  const deferredCity = useDeferredValue(city); // تحديث حقل الإدخال فوراً، وتحديث القائمة في الخلفية

  const filtered = useMemo(() => {
    const q = deferredCity.toLowerCase();
    return listings.filter((l) => l.city.toLowerCase().includes(q));
  }, [listings, deferredCity]);

  const parentRef = useRef(null);
  const rows = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
  });

  return (
    <>
      <Image src="/hero.jpg" alt="عقارات للبيع" width={1200} height={500} priority sizes="100vw" />
      <input value={city} onChange={(e) => setCity(e.target.value)} />
      <Suspense fallback={<div className="map-skeleton" />}>
        <MapView listings={filtered} />
      </Suspense>
      <div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
        <div style={{ height: rows.getTotalSize(), position: 'relative' }}>
          {rows.getVirtualItems().map((v) => (
            <div key={filtered[v.index].id}
                 style={{ position: 'absolute', top: 0, width: '100%', transform: `translateY(${v.start}px)` }}>
              <ListingCard listing={filtered[v.index]} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
```
سبب نجاح الحل: تم تحجيم صورة البداية وتقديمها بصيغة حديثة مع أولوية تحميل عالية (تحسن جذري في LCP). وعُزلت مكتبة الخرائط في حزمة منفصلة (تقليص الحزمة الأساسية). وضمن `useDeferredValue` سلاسة وفورية الكتابة مع جعل تصيير القائمة قابلاً للمقاطعة. وحافظت تقنية الـ Virtualization على البطاقات المرئية فقط في الـ DOM دون إرهاق الذاكرة. كل تحسين عالج اختناقاً تم قياسه بدقة.

## How to say it in the interview
- "أبدأ دائماً بالقياس، وأفصل بين أداء **التحميل الأولي (Loading)** (حجم الحزم، الصور، تتابع الطلبات) وأداء **وقت التشغيل (Runtime)** (إعادة التصيير، تضخم شجرة الـ DOM، العمليات الحاجبة). فلكل نوع أدواته الخاصة."
- "أكثر الحلول تأثيراً هي: تقسيم الكود (Code splitting)، وتحسين الصور، ومحاكاة القوائم الطويلة (Virtualization)، وتوطين الحالة (State colocation). ويأتي استخدام memoization بعد ذلك، أو يتكفل به React Compiler تلقائياً."
- فخ شائع: القول بأنك "تستخدم `useMemo` في كل مكان". سيسألك المقابل فوراً: كيف تأكدت من فائدته؟ أجب دوماً بأرقام ومقارنات حقيقية من الـ Profiler قبل التحسين وبعده.
- الموازنة (Trade-off): كل تحسين يضيف قدراً من التعقيد (واجهات انتظار للحزم المتأخرة، أو حساب ارتفاعات الصفوف للـ virtualization). لذلك لا تطبق التحسينات إلا في المواضع التي تثبت الأرقام حاجتها الماسة إليها.
