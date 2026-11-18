# ما هو الـ Closure في JavaScript، وكيف تستخدمه؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- ما هو الـ Closure؟ اشرح ذلك مع مثال.
- ما هي الـ Closures في JavaScript وكيف تستخدمها؟

## The concept (short answer)
- الـ **closure** هي دالة تأتي مجمّعة مع المتغيرات الخاصة بالنطاق (scope) الذي **أُنشئت فيه**. تحتفظ الدالة بإمكانية الوصول إلى هذه المتغيرات حتى بعد انتهاء تنفيذ الدالة الخارجية وإرجاع قيمتها.
- سبب عمل ذلك: تعتمد JavaScript على **النطاق المعجمي (lexical scope)**. عند إنشاء دالة، فإنها تحتفظ بمرجع (reference) إلى النطاق المحيط بها. وطالما أن الدالة الداخلية قابلة للوصول، فإن هذا النطاق يظل في الذاكرة ولا يقوم جامع المهملات (garbage collector) بحذفه.
- تحتفظ الدالة بـ **مرجع حي (live reference)** للمتغير وليس بنسخة من قيمته. فإذا تغيّر المتغير لاحقاً، ستشاهد الـ closure القيمة الجديدة.
- الاستخدامات اليومية: الحالة الخاصة (private state) مثل العدّادات (counters) وذاكرات التخزين المؤقت (caches)، ومصانع الدوال (function factories) مثل (`makeFormatter('EUR')`)، ومعالجات الأحداث (event handlers) ودوال رد النداء (callbacks) التي "تتذكر" البيانات، وتقنيات الـ `debounce` والـ `throttle`، وكذلك الطريقة التي تلتقط بها خطافات React (الـ hooks) الـ props والـ state في كل عملية تصيير (render).‏
- العثرات الشائعة: الـ **stale closures** (عندما يحتفظ الـ callback بقيمة قديمة)، وتسرّب الذاكرة (memory leaks) (عندما يُبقي مستمع أحداث طويل العمر كائناً ضخماً في الذاكرة دون تحريره).‏

```js
function makeCounter() {
  let count = 0;            // خاص: لا شيء في الخارج يمكنه الوصول إليه مباشرة
  return () => ++count;     // الدالة السهمية تلتقط وتُغلق على count
}
const next = makeCounter();
next(); // 1
next(); // 2 -> المتغير count استمر في الوجود بعد انتهاء makeCounter()
```

## Real-life example: the problem
تخيّل صفحة منتجات في موقع تجارة إلكترونية تحتوي على حقل بحث يقترح المنتجات أثناء كتابة المستخدم. كتب المطور دالة مساعدة باسم `debounce` بحيث لا يتم استدعاء الـ API إلا بعد توقف المستخدم عن الكتابة لمدة 300 مللي ثانية. اشتكى المستخدمون من أن الاقتراحات تومض باستمرار، وأظهر تبويب الشبكة (Network tab) إرسال طلب **مع كل ضغطة زر**. دالة الـ debounce لم تكن تفعل أي شيء إطلاقاً.

الخطأ البرمجي (bug): تم إنشاء المتغير `timerId` **داخل** الدالة المُرجَعة، وبالتالي تحصل كل ضغطة زر على متغير `timerId` جديد تماماً خاص بها، ودالة `clearTimeout` لا تلغي أي شيء.

```js
// BROKEN: debounce.js
export function debounce(fn, delay) {
  return function (...args) {
    let timerId;                      // متغير جديد مع كُل استدعاء
    clearTimeout(timerId);            // يلغي undefined دائماً
    timerId = setTimeout(() => fn(...args), delay);
  };
}

// search.js
const input = document.querySelector('#search');

async function fetchSuggestions(query) {
  const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`);
  renderSuggestions(await res.json());
}

input.addEventListener('input', debounce((e) => {
  fetchSuggestions(e.target.value);
}, 300));
// كتابة "laptop" تُطلق 6 طلبات متتالية للشبكة.
```

## How to fix it
انقل المتغير `timerId` إلى الدالة **الخارجية**، بحيث تشترك جميع استدعاءات الدالة المُرجَعة في نفس المتغير عبر الـ closure.‏

```js
// FIXED: debounce.js
export function debounce(fn, delay) {
  let timerId;                        // يُنشأ مرة واحدة فقط، وتشترك فيه جميع الاستدعاءات

  return function (...args) {
    clearTimeout(timerId);            // يلغي الطلب المعلق السابق
    timerId = setTimeout(() => {
      fn.apply(this, args);           // الحفاظ على سياق `this` لاستخدامها كدالة كائن
    }, delay);
  };
}

// search.js (دون تغيير)
input.addEventListener('input', debounce((e) => {
  fetchSuggestions(e.target.value);
}, 300));
// كتابة "laptop" تُطلق طلباً واحداً فقط، بعد 300 مللي ثانية من آخر ضغطة زر.
```

لماذا ينجح هذا الحل: يتم تنفيذ دالة `debounce` **مرة واحدة فقط** وتُنشئ متغيراً واحداً لـ `timerId`. وتُعتبر الدالة المُرجَعة closure تُغلق على هذا المتغير الوحيد، مما يسمح لكل ضغطة زر بإلغاء المؤقت الذي حددته الضغطة السابقة. هذا المتغير خاص تماماً، فلا يمكن لأي كود خارجي إعادة تعيينه أو تخريبه.

الفكرة ذاتها تنطبق على الحالة الخاصة (private state) ومصانع الدوال (function factories):‏

```js
function makePriceFormatter(currency) {
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency });
  return (amount) => fmt.format(amount); // تتذكر كلاً من fmt و currency
}
const toEUR = makePriceFormatter('EUR');
toEUR(19.9); // "€19.90"
```

حلول بديلة: استخدام كلاس بحقل خاص (`#timerId`) يؤدي نفس الغرض. وفي React، يتم عادةً الاحتفاظ بالمؤقت داخل `useRef` ليصمد عبر عمليات إعادة التصيير (re-renders).‏

## How to say it in the interview
- "الـ closure هي دالة تتذكر متغيرات النطاق الذي أُنشئت فيه، حتى بعد انتهاء تنفيذ هذا النطاق. وهي تحتفظ بمرجع حي للمتغير وليس بنسخة منه."
- اذكر مثالاً عملياً على الفور: الحالة الخاصة (عداد، كاش) أو الـ `debounce`. يُفضّل المحاورون دائماً الأمثلة الحقيقية على مجرد سرد التعريفات النظرية.
- سؤال متابعة شائع: لغز حلقة `for` مع `var` و `setTimeout`. تلتقط جميع دوال رد النداء نفس المتغير `i` المشترك، فتنتهي بطباعة القيمة النهائية فقط. والحل هو استخدام `let` (التي تنشئ رابطاً جديداً في كل دورة) أو دالة IIFE.‏
- المفاضلات (Trade-offs): تُبقي الـ closures نطاقاتها في الذاكرة طالما كانت قيد الاستخدام. ومستمع الأحداث طويل العمر الذي يُغلق على كائن كبير قد يتسبب في تسريب للذاكرة، لذا يجب إزالة المستمعات غير المستخدمة. وفي React، انتبه من الـ **stale closures** في دوال رد نداء `useEffect` و `setInterval`.‏
