# سؤال برمجي عملي: بناء مكوّن بحث عن المنتجات (Product Search Component)

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- بناء مكوّن بحث عن المنتجات باستخدام React. المتطلبات: عرض قائمة من المنتجات، توفير حقل إدخال للبحث، إظهار أسماء المنتجات المطابقة لكلمة البحث، عرض كافة المنتجات عند فراغ حقل البحث، وتجاهل حالة الأحرف (Case-insensitive).

## The concept (short answer)
- يختبر هذا السؤال مهارات React الجوهرية: **المدخلات المضبوطة (Controlled inputs)**، و**إدارة الحالة (State)**، و**البيانات المشتقة (Derived data)**، و**تصيير القوائم مع المفاتيح (Keys)**، والتصيير الشرطي النظيف.
- الفكرة الأساسية الحاسمة: قم بتخزين **نص البحث (search query)** فقط في الـ state. أما القائمة المصفاة فيتم **اشتقاقها وحسابها** مباشرة من `products` و `query` أثناء التصيير. وتجنب **تماماً** نسخ القائمة المصفاة في `useState` ثانٍ ومزامنتها عبر `useEffect`؛ فهذا يسبب عمليات تصيير زائدة ومصدراً كبيراً للأخطاء البرمجية.
- تجاهل حالة الأحرف: توحيد الطرفين باستخدام `.toLowerCase()` (أو `toLocaleLowerCase()`)، مع استخدام `.trim()` لنص البحث لتجاهل المسافات الفارغة مثل "  shoe ".
- البحث الفارغ: التعبير `"".includes` يطابق كل شيء، ولكن من الأوضح والأفضل إرجاع القائمة الكاملة صراحة.
- لمسات هندسية احترافية يحب المحاور سماعها: رسالة واضحة عند عدم وجود نتائج (Empty state)، وتسمية مدخلات قابلة للوصول (`<label>`)، وإعلان عدد النتائج لقارئات الشاشة، واستخدام `useMemo` للمصفوفات الضخمة، و `useDeferredValue` لإبقاء حقل الكتابة فائق السلاسة.

## Real-life example: the problem
حالة شائعة: أطلقت صيدلية إلكترونية مربع بحث بسيط. اشتكى المستخدمون من:
- كتابة "Vitamin " (مع مسافة في النهاية، وهو أمر معتاد على لوحات مفاتيح الهواتف مع الإكمال التلقائي) لا تُظهر أي نتيجة.
- البحث عن "IBUPROFEN" لا يجد شيئاً لأن البيانات مكتوبة كـ "Ibuprofen".
- البحث بدون نتائج يعرض مساحة بيضاء فارغة، مما يوحي للمستخدم بأن الصفحة معطلة.
- مع وجود 20,000 منتج، كانت كل ضغطة مفتاح تجمد حقل الإدخال لمدة ~150 مللي ثانية على الهواتف المتوسطة.
- مستخدمو قارئات الشاشة يسمعون فقط "edit text" دون معرفة وظيفة الحقل لغياب التسمية.

```jsx
// النسخة البدائية المعطوبة
function ProductSearch({ products }) {
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState(products);

  useEffect(() => {
    // تصيير زائد مع كل ضغطة زر، حساس لحالة الأحرف، وبلا trim
    setFiltered(products.filter((p) => p.name.includes(query)));
  }, [query]);                                   // نسيان الاعتمادية `products`: قائمة غير محدثة

  return (
    <div>
      <input placeholder="Search" onChange={(e) => setQuery(e.target.value)} />
      <ul>
        {filtered.map((p, i) => <li key={i}>{p.name}</li>)}  {/* استخدام الفهرس index كمفتاح key */}
      </ul>
    </div>
  );
}
```

## How to fix it
الحل الأنيق المتقن الذي يلبي كافة المتطلبات (وهذا ما تبدأ بكتابته أولاً في المقابلة):

```jsx
import { useState } from "react";

const PRODUCTS = [
  { id: 1, name: "Ibuprofen 400mg" },
  { id: 2, name: "Vitamin C 1000mg" },
  { id: 3, name: "Vitamin D3 Drops" },
  { id: 4, name: "Paracetamol 500mg" },
  { id: 5, name: "Hand Sanitizer Gel" },
];

export default function ProductSearch({ products = PRODUCTS }) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const visibleProducts = normalizedQuery === ""
    ? products
    : products.filter((p) => p.name.toLowerCase().includes(normalizedQuery));

  return (
    <section>
      <label htmlFor="product-search">Search products</label>
      <input
        id="product-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g. vitamin"
        autoComplete="off"
      />

      {visibleProducts.length === 0 ? (
        <p>No products match "{query.trim()}".</p>
      ) : (
        <ul>
          {visibleProducts.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

نسخة متقدمة قابلة للتوسع للكتالوجات الضخمة (تذكرها أو تكتبها كسؤال متابعة):

```jsx
import { useDeferredValue, useMemo, useState } from "react";

export default function ProductSearch({ products }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);   // يتم تحديث الإدخال أولاً، ثم تلحق القائمة به
  const isStale = query !== deferredQuery;

  // حساب الأسماء بالأحرف الصغيرة مسبقاً مرة لكل مصفوفة منتجات
  const indexed = useMemo(
    () => products.map((p) => ({ ...p, search: p.name.toLowerCase() })),
    [products]
  );

  const visibleProducts = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return q ? indexed.filter((p) => p.search.includes(q)) : indexed;
  }, [indexed, deferredQuery]);

  return (
    <section>
      <label htmlFor="product-search">Search products</label>
      <input id="product-search" type="search" value={query}
             onChange={(e) => setQuery(e.target.value)} />

      <p aria-live="polite">{visibleProducts.length} products found</p>

      <ul style={{ opacity: isStale ? 0.6 : 1 }}>
        {visibleProducts.slice(0, 100).map((p) => <li key={p.id}>{p.name}</li>)}
      </ul>
    </section>
  );
}
```

لماذا ينجح هذا الحل:
- **الحالة المشتقة (Derived state)**: مصدر وحيد للحقيقة (`query`)، دون مزامنة بـ `useEffect`، وبلا أخطاء قوائم قديمة، مع تصيير واحد لكل ضغطة زر.
- **تجاهل حالة الأحرف والمسافات**: توحيد الأحرف الصغيرة وإزالة المسافات بالأطراف، فتطابق "  IBUPROFEN " منتج "Ibuprofen 400mg".
- **البحث الفارغ** يُرجع الكتالوج كاملاً؛ و**الحالة الفارغة** تشرح للمستخدم غياب النتائج بدلاً من مساحة بيضاء مضللة.
- **المفاتيح المستقرة (Stable keys)** عبر `p.id` تحافظ على دقة عناصر شجرة الـ DOM.
- **إمكانية الوصول (Accessibility)**: وسم `<label>` حقيقي، ونوع `type="search"`، وتنبيه بعدد النتائج عبر `aria-live`.
- **الأداء العالي**: يتخطى `useMemo` إعادة العمليات الحسابية غير اللازمة؛ ويبقي `useDeferredValue` حقل الكتابة مستجيباً عبر تصيير القائمة بأولوية أقل.

بدائل أخرى: تطبيق الـ debounce (200-300 مللي ثانية) إذا كان البحث يطلق طلب API؛ واستخدام مكتبات مثل Fuse.js للبحث التقريبي والتسامح مع الأخطاء الإملائية.

## How to say it in the interview
- "أحتفظ بنص البحث فقط في الـ state وأشتق القائمة المصفاة أثناء التصيير؛ وأوحد الأحرف الصغيرة مع استخدام trim، ويعرض البحث الفارغ كامل القائمة."
- اذكر الحالات الحدية (Edge cases) استباقياً: المسافات الزائدة، رسالة عدم وجود نتائج، المفاتيح المستقرة، والتسمية الدلالية؛ فالمحاورون يقيّمون هذا التفكير الهندسي بقدر تقييمهم للكود.
- سؤال المتابعة: "ماذا لو احتوت القائمة على 50,000 منتج؟" نستخدم `useMemo` و `useDeferredValue`، وتقنية المحاكاة الافتراضية للقوائم (Virtualization عبر `react-window` أو TanStack Virtual)، أو نقل البحث إلى الخادم مع debounce وإلغاء الطلبات السابقة.
- فخ المقابلة: تخزين `filteredProducts` في state منفصل ومزامنته بـ `useEffect`؛ فهذا يضيف دورة تصيير إضافية، ونسيان الاعتماديات يُظهر نتائج قديمة غير محدثة.
