# ميزات التزامن (Concurrent Features) في React 18 وتأثيرها على المعمارية

**Level:** Senior
**Merged from (original phrasings):**
- اشرح ميزات التزامن (Concurrent Features) في React 18 وكيف تؤثر على معمارية التطبيق.

## The concept (short answer)

يعني التصيير المتزامن (Concurrent rendering) قدرة React على **تحضير واجهة مستخدم جديدة في الخلفية، ومقاطعتها، والتخلص منها تماماً** إذا طرأ تحديث أكثر إلحاحاً. ويتم تفعيل هذه الإمكانية اختيارياً لكل تحديث عبر الميزات التالية:

- **التجميع التلقائي (Automatic batching):** استدعاءات `setState` المتعددة في نفس دورة التنفيذ (tick) تُنتج تصييراً واحداً فقط - وينطبق ذلك الآن أيضاً داخل وعود الـ promises، ودوال `setTimeout`، ومعالجات الأحداث الأصلية (native event handlers) بعد أن كان مقتصراً قبل React 18 على معالجات أحداث React فقط. ويمكن الخروج من هذا السلوك عبر `flushSync`.
- **`useTransition` / `startTransition`:** تُميّز التحديث على أنه غير عاجل (non-urgent). فتتمكن التحديثات العاجلة (كالكتابة والنقر) من مقاطعته فوراً؛ بينما تُتيح لك خاصية `isPending` إظهار مؤشر تحميل مع الحفاظ على تفاعلية الواجهة الحالية.
- **`useDeferredValue`:** هي المقابل لـ `startTransition` عندما "لا تملك دالة التعديل (setter)" - حيث تُعيد React أولاً تصيير المكون بالقيمة القديمة، ثم تُصيّر القيمة المؤجلة في الخلفية.
- **Suspense + التصيير المتدفق عبر الخادم (Streaming SSR):** يُرسل الخادم هيكل الـ HTML الأولي فوراً، ثم يتدفق كود HTML لكل حد `<Suspense>` بمجرد اكتمال جلب بياناته (`renderToPipeableStream`، وهو السلوك الافتراضي في Next.js App Router). وبذلك لم تعد البيانات البطيئة تُعطل تحميل الصفحة بأكملها.
- **الترطيب الانتقائي (Selective hydration):** تترطب حدود الـ Suspense بشكل مستقل؛ وإذا نقر المستخدم على جزء لم يترطب بعد، تُعطي React الأولوية لترطيب ذلك الحد أولاً.

**التأثير المعماري:** يجب أن تكون دوال التصيير نقية وخالية من الآثار الجانبية ومحايدة التأثير (pure and idempotent) - نظراً لأنها قد تعمل عدة مرات أو يتم التخلص من نتائجها (يستدعي وضع StrictMode المكونات مرتين لكشف ذلك)؛ ويجب على مخازن البيانات الخارجية القابلة للتعديل استخدام `useSyncExternalStore` لتفادي ظاهرة **التناقض البصري (tearing)** (عرض مكونات مختلفة لنسخ متباينة من نفس المخزن في تصيير واحد)؛ وتصميم الصفحات حول **حدود Suspense** (توزيع حالات التحميل بحسب التخطيط Layout وليس في كل مكون منفرد)؛ وتصنيف التحديثات بين عاجلة (urgent) وانتقالية (transition). التزامن لا يجعل الكود البطيء سريعاً - بل يُحافظ على استجابة المدخلات أثناء تشغيل العمليات البطيئة.

## Real-life example: the problem

كتالوج قطع غيار B2B يحتوي على 8,000 وحدة (SKU) تتم تصفيتها من جانب العميل. تبدو الكتابة في صندوق البحث ثقيلة ومتقطعة على أجهزة العمل: تؤدي كل ضغطة مفتاح إلى تجميد حقل الإدخال لـ ~300ms، وتظهر الحروف في دفعات مفاجئة، كما يؤدي التبديل بين تبويبي "Grid" و "Table" إلى تجميد الصفحة بالكامل.

```jsx
function Catalog({ products }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');

  // Runs on every keystroke, synchronously, with the same priority as the input itself
  const results = products.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search parts" />
      <button onClick={() => setView('grid')}>Grid</button>
      <button onClick={() => setView('table')}>Table</button>
      {view === 'grid' ? <ProductGrid items={results} /> : <ProductTable items={results} />}
    </>
  );
}
```

يحدث تحديث حقل الإدخال وتصيير القائمة الضخمة والمكلفة في دورة تصيير متزامنة واحدة. ولا تستطيع React رسم الحرف الجديد حتى تنتهي من حساب الفروقات (diffing) لـ 8,000 صف، فتتأخر الاستجابة وتتراكم النقرات في طابور الانتظار.

## How to fix it

افصل التحديث العاجل (حقل الإدخال) عن التحديث المكلف حوسبياً (القائمة)، وطبّق الـ memoization على القائمة لتمكين React من تخطي تصييرها أو مقاطعتها في الخلفية.

```jsx
import { memo, useDeferredValue, useMemo, useState, useTransition } from 'react';

const ProductGrid = memo(function ProductGrid({ items }) { /* ...renders cards... */ });
const ProductTable = memo(function ProductTable({ items }) { /* ...renders rows... */ });

function Catalog({ products }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');
  const [isPending, startTransition] = useTransition();

  const deferredQuery = useDeferredValue(query);   // lags behind during heavy renders
  const isStale = query !== deferredQuery;

  const results = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(deferredQuery.toLowerCase())),
    [products, deferredQuery]
  );

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search parts" />
      <button onClick={() => startTransition(() => setView('grid'))}>Grid</button>
      <button onClick={() => startTransition(() => setView('table'))}>Table</button>
      <div style={{ opacity: isStale || isPending ? 0.6 : 1 }}>
        {view === 'grid' ? <ProductGrid items={results} /> : <ProductTable items={results} />}
      </div>
    </>
  );
}
```

لماذا ينجح هذا الحل: يُصيّر ضغط المفتاح فورياً باستخدام قيمة `deferredQuery` *القديمة*، فيسمح `memo` لـ React بتخطي إعادة تصيير القائمة ورسم الحرف في الحال. ثم تُصيّر React القائمة بالقيمة الجديدة في الخلفية على شرائح زمنية تقدر بـ ~5ms؛ وإذا ضغط المستخدم مفتاحاً جديداً، يتم التخلي عن ذلك التصيير في الخلفية فوراً وإعادة بدئه. أما التبديل بين التبويبات فيُعامل كـ transition، مما يحافظ على تفاعلية العرض الحالي أثناء تجهيز العرض الجديد. وإذا كانت معالجة 8,000 صف لا تزال بطيئة، فإن الحل المعماري الجذري هو الـ Virtualization (باستخدام `@tanstack/react-virtual`) أو التصفية من جانب الخادم - فالتزامن يخفي زمن الاستجابة، لكنه لا يلغي حجم العمل الحوسبي.

التدفق (Streaming) + الترطيب الانتقائي (Selective hydration) في صفحة المنتج (App Router):

```jsx
export default async function ProductPage({ params }) {
  const { sku } = await params;
  const product = await getProduct(sku);            // fast, critical: in the shell
  return (
    <>
      <ProductHeader product={product} />
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews sku={sku} />                       {/* slow service: streamed later, hydrated on its own */}
      </Suspense>
    </>
  );
}
```

## How to say it in the interview

- "يمنح React المتزامن (Concurrent React) القدرة على مقاطعة التصيير وإدارته بالأولويات. أقوم بتمييز التحديثات الثقيلة وغير العاجلة كـ transitions أو قيم مؤجلة deferred values لضمان بقاء استجابة مدخلات المستخدم فورية، كما أصمم الصفحات حول حدود Suspense لتتدفق البيانات البطيئة دون حجب الصفحة."
- فخ المقابلة: لا يمكن تغليف حالة حقل الإدخال المضبوط (controlled input) داخل `useTransition` - إذ يجب أن يُحدّث الإدخال بشكل عاجل دائماً؛ بل قم بتأجيل المكون المستهلك للقيمة بدلاً منه. كما أن الـ transitions لا تُغني عن تقنية الـ debounce لطلبات الشبكة؛ بل استخدم `AbortController` أو مكتبة استعلامات (query library) لهذا الغرض.
- سؤال متابعة: "ما هو التناقض البصري (Tearing)؟" - هو قراءة تصيير متزامن لمخزن بيانات خارجي قابل للتعديل أثناء تغيره في منتصف عملية التصيير؛ ويُحل ذلك باستخدام خطاف `useSyncExternalStore` (وهو ما تعتمده داخلياً مكتبات Redux و Zustand و TanStack Query).
- المفاضلة (Trade-off): يفرض التزامن تكلفة حوسبية إضافية في عمليات التصيير (حيث يمكن التخلص من نتائج بعضها) ويجعل التوقيتات أقل قابلية للتنبؤ المسبق؛ وتبرز قوته القصوى في واجهات المستخدم كثيفة الاستهلاك للمعالج (CPU-heavy UIs)، وليس في بطء عمليات الإدخال والإخراج (I/O).
