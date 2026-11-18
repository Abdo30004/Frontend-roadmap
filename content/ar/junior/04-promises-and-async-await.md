# ما هي الـ Promises وكيف تعمل مع async/await؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- ما هي الـ Promises؟ اشرح "async/await" مع أمثلة.
- كيف تتعامل مع الكود غير المتزامن باستخدام async/await و Promises؟

## The concept (short answer)
- الـ **Promise** هي كائن يمثل قيمة ستكون متاحة مستقبلاً. وتمتلك 3 حالات: **قيد الانتظار (pending)**، أو **مُحققة (fulfilled)** (بقيمة ناجحة)، أو **مرفوضة (rejected)** (بخطأ). وبمجرد استقرارها (settled)، لا تتغير حالتها أبداً.
- تقرأ النتيجة عبر `.then(onFulfilled)`، وتعالج الأخطاء بـ `.catch(onError)`، وتنفذ عمليات التنظيف بـ `.finally()`. وتُرجع كل `.then` كائن Promise جديداً، مما يتيح لك **تسلسل (chain)** الخطوات بدلاً من تداخل دوال رد النداء ("callback hell").
- صياغة `async/await` هي غلاف تركيبي أنيق (syntactic sugar) فوق الـ Promises. ترجع الدالة المعرفة بـ `async` **دائماً كائن Promise**. بينما توقف `await` تنفيذ تلك الدالة مؤقتاً (دون تجميد الصفحة بأكملها) حتى يستقر الـ Promise، ثم تعطيك القيمة أو **ترمي** الخطأ، مما يتيح لك استخدام صياغة `try/catch` المعتادة.
- تعمل دوال رد نداء الـ Promise كـ **مهام دقيقة (microtasks)**، حيث تُنفذ فور انتهاء الكود المتزامن الحالي وقبل مؤقتات المتصفح (`setTimeout`).
- دوال التجميع (Combinators): `Promise.all` (تنفيذ متوازٍ يفشل فوراً إذا فشل أحدها)، و `Promise.allSettled` (تنتظر الجميع وتعطيك نتيجة كل طلب نجاحاً أو فشلاً)، و `Promise.race` (أول Promise يستقر)، و `Promise.any` (أول Promise ينجح).

```js
// نفس المنطق بأسلوبين
fetch('/api/user')
  .then((res) => res.json())
  .then((user) => console.log(user.name))
  .catch((err) => console.error(err));

async function showUser() {
  try {
    const res = await fetch('/api/user');
    const user = await res.json();
    console.log(user.name);
  } catch (err) {
    console.error(err);
  }
}
```

## Real-life example: the problem
تخيّل صفحة إتمام الدفع لحجز رحلة سفر. تحتاج الصفحة إلى تحميل الملف الشخصي للمستخدم، وسلة المشتريات، وطرق الدفع المتاحة قبل عرض زر "Pay". اشتكى المستخدمون من أن الصفحة تستغرق **أكثر من 3 ثوانٍ** للتحميل. وفي بعض الأحيان ظهرت عبارة **"Total: $undefined"**، وعندما أرجعت واجهة برمجة تطبيقات الدفع خطأ 500، استمر مؤشر التحميل في **الدوران للأبد** دون أي رسالة توضيحية.

ثلاثة أخطاء برمجية: تنفيذ الطلبات بشكل متتالٍ دون داعٍ، نسيان كلمة `await` مما أرجع كائن Promise بدلاً من البيانات الرقمية، وحقيقة أن `fetch` لا ترفض (reject) الـ Promise عند أخطاء HTTP (بل ترفض فقط عند انقطاع الشبكة)، فلم يلتقط أي كود خطأ الـ 500.

```js
// BROKEN: checkout.js
async function loadCheckout() {
  showSpinner();

  const profile = await fetch('/api/profile').then((r) => r.json());   // تستغرق 1 ثانية
  const cart = await fetch('/api/cart').then((r) => r.json());         // تستغرق 1 ثانية، وتنتظر انتهاء profile دون مبرر
  const methods = await fetch('/api/payment-methods').then((r) => r.json()); // تستغرق 1 ثانية

  const total = calculateTotal(cart); // دالة calculateTotal هي async -> إذن total هي Promise وليست رقماً
  renderCheckout({ profile, cart, methods, total }); // تعرض "$undefined"
  hideSpinner(); // لا يصل التنفيذ إلى هنا إطلاقاً إذا رُمي أي خطأ
}

async function calculateTotal(cart) {
  const res = await fetch('/api/pricing', { method: 'POST', body: JSON.stringify(cart) });
  return (await res.json()).total;
}

loadCheckout(); // لا يوجد catch -> خطأ "Uncaught (in promise)" ومؤشر تحميل لا نهائي
```

## How to fix it

```js
// FIXED: checkout.js
async function getJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`${url} failed with status ${res.status}`); // تحويل أخطاء HTTP إلى أخطاء تُرمى صراحة
  }
  return res.json();
}

async function calculateTotal(cart) {
  const data = await getJSON('/api/pricing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cart),
  });
  return data.total;
}

async function loadCheckout() {
  showSpinner();
  try {
    // الطلبات المستقلة تعمل بالتوازي: تستغرق حوالي ثانية واحدة بدلاً من 3 ثوانٍ
    const [profile, cart, methods] = await Promise.all([
      getJSON('/api/profile'),
      getJSON('/api/cart'),
      getJSON('/api/payment-methods'),
    ]);

    const total = await calculateTotal(cart); // يعتمد على cart، لذا ينتظر هنا
    renderCheckout({ profile, cart, methods, total });
  } catch (err) {
    showError('We could not load your checkout. Please try again.');
    console.error(err);
  } finally {
    hideSpinner(); // تُنفذ دائماً سواء في حالة النجاح أو الخطأ
  }
}

loadCheckout();
```

لماذا ينجح هذا الحل:
- تُطلق `Promise.all` الطلبات الثلاثة المستقلة معاً وتنتظر اكتمالها جميعاً. وفقط طلب التسعير، الذي يحتاج بيانات السلة، ينتظر توفرها.
- استدعاء `await calculateTotal(cart)` يستخرج القيمة الرقمية الحقيقية من الـ Promise.
- تتحقق الدالة المساعدة `getJSON` من `res.ok`، مما يحول كود 500 إلى خطأ يلتقطه بلوك `try/catch`؛ وتضمن كتلة `finally` إخفاء مؤشر التحميل دائماً.

حل بديل: إذا كان فشل أحد الطلبات يجب ألا يعطل الصفحة بأكملها (مثل التوصيات الاختيارية)، فاستخدم `Promise.allSettled` وعالج كل نتيجة بشكل منفصل.

## How to say it in the interview
- "الـ Promise هي كائن يمثل قيمة مستقبلية بثلاث حالات: pending و fulfilled و rejected. و `async/await` هي غلاف تركيبي فوق الـ Promises يتيح لي كتابة الكود غير المتزامن بأسلوب تراتبي من الأعلى للأسفل ومعالجة أخطائه عبر `try/catch`."
- "أشغّل الطلبات المستقلة بالتوازي دائماً باستخدام `Promise.all`؛ فالاستدعاءات المتتالية بـ `await` في صف واحد هي أحد أشهر أخطاء الأداء الشائعة."
- فخ المقابلة: دالة `fetch` لا ترفض إلا عند انقطاع الاتصال بالشبكة، ولا ترفض عند أخطاء 404 أو 500. لذلك يجب دائماً التحقق من `response.ok`.
- فخ آخر: استخدام `await` داخل `array.forEach` لا ينتظر العمليات. استخدم حلقة `for...of` للعمليات المتتالية، أو `Promise.all(array.map(...))` للعمليات المتوازية.
