# ما الفرق بين map و filter و reduce و forEach في JavaScript؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- اشرح دوال المصفوفات في JavaScript مثل ("map" و "filter" و "reduce" و "forEach" وغيرها).‏

## The concept (short answer)
تأخذ كل دالة مصفوفة دالة رد نداء بالصيغة `(item, index, array)`. والمفتاح الأساسي لإتقانها هو معرفة **ما الذي تُرجعه كل دالة** و**هل تُعدل المصفوفة الأصلية أم لا**.

| الدالة | القيمة المُرجعة | متى تستخدمها |
|---|---|---|
| `map` | مصفوفة جديدة بنفس الطول تماماً | تحويل كل عنصر إلى شكل جديد |
| `filter` | مصفوفة جديدة بنفس الطول أو أقصر | الإبقاء على العناصر التي تجتاز اختباراً محدداً |
| `reduce` | قيمة وحيدة (من أي نوع: رقم، كائن، مصفوفة) | الجمع، التجميع (grouping)، بناء هيكل بيانات جديد |
| `forEach` | تعود دائماً بـ `undefined` | للآثار الجانبية فقط (logging، تعديل DOM، تحليلات)؛ ولا يمكن إيقافها بـ `break` |
| `find` / `findIndex` | أول عنصر مطابق / الفهرس الخاص به (`undefined` / `-1`) | البحث عن عنصر واحد محدد |
| `some` / `every` | قيمة منطقية (boolean) | "هل يوجد أي عنصر؟" / "هل تنطبق على الجميع؟" (تتوقف مبكراً) |
| `includes` | قيمة منطقية (boolean) | التحقق من وجود قيمة بدائية (primitive) |
| `flatMap` | مصفوفة جديدة مسطحة | دمج `map` مع تسطيح المصفوفة بمستوى واحد |

- **دوال غير معدلة (Non-mutating):** `map`، و `filter`، و `reduce`، و `slice`، و `concat`، و `toSorted`، و `toReversed` (في مواصفة ES2023).‏
- **دوال مُعدّلة للأصل (Mutating):** `push`، و `pop`، و `splice`، و `sort`، و `reverse`. هذا التفريق بالغ الأهمية في React، حيث يُحظر تعديل الـ state مباشرة.
- استدعاء `sort()` دون دالة مقارنة يرتب العناصر كـ **سلاسل نصية (strings)**: التعبير `[10, 9, 1].sort()` يُعطي `[1, 10, 9]`. استخدم دائماً `(a, b) => a - b`.‏
- يمكن **تسلسل (chaining)** الدوال لأن `map` و `filter` تُرجعان مصفوفات جديدة: `orders.filter(...).map(...)`.‏

```js
const prices = [20, 5, 50];
prices.map((p) => p * 1.2);            // [24, 6, 60]
prices.filter((p) => p > 10);          // [20, 50]
prices.reduce((sum, p) => sum + p, 0); // 75
prices.find((p) => p > 10);            // 20
prices.some((p) => p > 40);            // true
```

## Real-life example: the problem
تخيّل صفحة سلة مشتريات لمتجر بقالة إلكتروني في React. أبلغ المستخدمون عن ثلاثة أمور غير طبيعية: أظهر مجموع السلة إما **"0"** أو نصاً غريباً مثل **"[object Object]2.5"**، وتغير ترتيب المنتجات في جزء آخر من الصفحة بمجرد النقر على "Sort by price"، وكانت قائمة العناصر فارغة تماماً.

```jsx
// BROKEN: Cart.jsx
export function Cart({ items }) {
  // items: [{ id, name, price, qty, inStock }]

  // 1. ترجع forEach القيمة undefined -> لا شيء ليتم تصييره
  const rows = items.forEach((item) => (
    <li key={item.id}>{item.name} x {item.qty}</li>
  ));

  // 2. استخدام reduce بدون قيمة ابتدائية: يكون المجمع الأول (accumulator) كائناً
  const total = items.reduce((sum, item) => sum + item.price * item.qty);

  // 3. تُعدل ()sort مصفوفة `items` الممررة عبر الـ prop في مكانها، وترتب الأرقام كنصوص
  const byPrice = items.sort((a, b) => a.price > b.price);

  return (
    <>
      <ul>{rows}</ul>
      <p>Total: ${total}</p>
      <p>Cheapest: {byPrice[0].name}</p>
    </>
  );
}
```

ما الذي حدث بشكل خاطئ:
1. تُرجع `forEach` دائماً `undefined`، لذا بقيت القائمة فارغة.
2. بدون قيمة ابتدائية (initial value)، تستخدم `reduce` **أول كائن عنصر** كقيمة بداية للمتغير `sum`، مما يحول عملية `object + number` إلى دمج نصوص مشوه.
3. دالة `sort` تُغير المصفوفة الأصلية في المكون الأب (وهي prop قادمة من الخارج)، مما يُعطل المكونات الأخرى التي تستخدم نفس البيانات. كما أن دالة المقارنة أعادت قيمة منطقية بدلاً من رقم، مما يجعل الترتيب غير مستقر.

## How to fix it

```jsx
// FIXED: Cart.jsx
export function Cart({ items }) {
  const inStock = items.filter((item) => item.inStock);

  const rows = inStock.map((item) => (
    <li key={item.id}>
      {item.name} x {item.qty}
    </li>
  ));

  const total = inStock.reduce((sum, item) => sum + item.price * item.qty, 0); // البداية دائماً من 0

  const byPrice = inStock.toSorted((a, b) => a.price - b.price); // نسخة مرتبة مع مقارنة رقمية
  // في المتصفحات القديمة: [...inStock].sort((a, b) => a.price - b.price)

  if (inStock.length === 0) return <p>Your cart is empty.</p>;

  return (
    <>
      <ul>{rows}</ul>
      <p>Total: ${total.toFixed(2)}</p>
      <p>Cheapest: {byPrice[0].name}</p>
    </>
  );
}
```

لماذا ينجح هذا الحل: تُرجع `map` مصفوفة جديدة من عناصر JSX التي تستطيع React تصييرها بكفاءة. وتبدأ `reduce` من القيمة `0`، ليكون المجمع رقماً دائماً. وتترك دالة `toSorted` (أو استخدام عامل الانتشار `...` لنسخ المصفوفة أولاً) الـ prop الأصلية دون أي مساس، وتُرجع دالة `a.price - b.price` رقماً سالباً أو صفراً أو موجباً كما تتطلب `sort`. ويحافظ تسلسل `filter` ثم `map` على بساطة كل خطوة ووضوحها.

نمط تجميع مفيد للغاية باستخدام `reduce`:‏

```js
const byCategory = items.reduce((groups, item) => {
  (groups[item.category] ??= []).push(item);
  return groups;
}, {});
// البديل الحديث في المتصفحات: Object.groupBy(items, (item) => item.category)
```

## How to say it in the interview
- "`map` تقوم بالتحويل، و `filter` بالاختيار والتصفية، و `reduce` بالدمج في قيمة واحدة، بينما `forEach` مخصصة للآثار الجانبية فقط لأنها تُرجع `undefined` دائماً."
- "في React، أقوم بتصيير القوائم دائماً باستخدام `map` وليس `forEach`، وأتجنب تماماً الدوال المُعدّلة مثل `sort` و `splice` على الـ state أو الـ props؛ بل أنسخ المصفوفة أولاً أو أستخدم `toSorted`."
- فخ المقابلة: مرّر دائماً قيمة ابتدائية لدالة `reduce`؛ فبدونها، ستتسبب المصفوفة الفارغة في رمي خطأ `TypeError`.‏
- المفاضلة: تسلسل `filter().map()` يدور حول العناصر مرتين. وفي قوائم واجهة المستخدم المعتادة، هذا أمر طبيعي ويوفر كوداً نظيفاً وقابلاً للقراءة؛ ولا تلجأ لدمجها في حلقة واحدة إلا عندما تُثبت اختبارات الأداء (profiling) وجود تكلفة حقيقية على مصفوفات ضخمة.
