# كيف يعمل الـ Event Loop في JavaScript (المهام Tasks، والـ Microtasks، والـ Promises، والتصيير Rendering)؟

**Level:** Mid
**Merged from (original phrasings):**
- اشرح الـ Event Loop في JavaScript.
- كيف يتعامل الـ Event Loop مع الـ Promises و async/await والتصيير (Rendering)؟

## The concept
- تعمل لغة JavaScript على **مسار تنفيذ أحادي (Single Thread)** يمتلك **Call Stack** واحداً فقط. أي كود تزامني (Synchronous) يستغرق وقتاً طويلاً يحجب كل شيء: النقرات، والمؤقتات، وتحديثات الشاشة (Painting).
- يكرر الـ Event Loop في المتصفح هذه الدورة باستمرار:
  1. يسحب **مهمة واحدة (Task / Macrotask)** من قائمة المهام (Task Queue): مثل دوال رد النداء لـ `setTimeout`، أو معالجات أحداث النقر، أو أحداث `message`، أو ردود الشبكة. وينفذها حتى يفرغ الـ Call Stack بالكامل.
  2. **يفرغ كامل طابور الـ Microtasks (Microtask Queue)**: مثل توابع الـ Promise (`.then/.catch/.finally`)، والكود الذي يلي `await`، و `queueMicrotask`، و `MutationObserver`. حتى الـ Microtasks التي تتم جدولتها أثناء هذه الخطوة تُنفذ أيضاً قبل الانتقال للخطوة التالية.
  3. **إمكانية التصيير (Maybe render)** (كل 16.6 مللي ثانية تقريباً عند تردد 60Hz): ينفذ دوال `requestAnimationFrame`، ثم يحسب الـ Style والـ Layout ويقوم بعملية الـ Paint.
- الـ `async/await` مجرد غطاء نحوي (Syntactic sugar) للـ Promises. كل كود قبل أول `await` يُنفذ بشكل تزامني تماماً، وما بعد الـ `await` يُجدول كـ Microtask بمجرد اكتمال القيمة المنتظرة.
- سبب أهمية هذا الفهم: الـ Microtasks قد تسبب **حجب التصيير (Starve rendering)**، لأن المتصفح عاجز عن الرسم قبل إفراغ طابور الـ Microtasks تماماً. وأي مهمة طويلة (Long Task تتجاوز 50ms) تُسبب بطئاً مرئياً ملحوظاً (Jank) وتضر مقياس INP.

### أحجية ترتيب المخرجات
```js
console.log('1 sync');

setTimeout(() => console.log('2 timeout'), 0);

requestAnimationFrame(() => console.log('3 rAF'));

Promise.resolve()
  .then(() => console.log('4 micro A'))
  .then(() => console.log('5 micro B'));

(async () => {
  console.log('6 async start');
  await null;
  console.log('7 after await');
})();

queueMicrotask(() => console.log('8 queueMicrotask'));

console.log('9 sync end');
```
المخرجات:
```
1 sync
6 async start          <- الجزء التزامني من الدالة غير المتزامنة ينفذ فوراً
9 sync end
4 micro A              <- الـ microtasks تنفذ بترتيب FIFO
7 after await
8 queueMicrotask
5 micro B              <- الـ .then المتسلسلة جدولت فقط بعد اكتمال A
2 timeout              <- الـ task التالية (غالباً قبل rAF، ولكن ليس مضموناً 100%)
3 rAF                  <- مباشرة قبل الـ paint التالي
```
الترتيب بين `2 timeout` و `3 rAF` يعتمد على توقيت إطار الشاشة (Frame timing). أما الـ Microtasks فتُنفذ دوماً قبلهما معاً.

## Real-life example
لوحة تحكم لوجستية تستورد ملف CSV يحتوي على 20,000 شحنة. أضاف المطور شريط تقدم وحاول التنازل عن دور المعالجة (yield) باستخدام `await Promise.resolve()` بعد كل دفعة، متوقعاً أن يتحرك الشريط بسلاسة. لكن المستخدمين تفاجأوا بتجمد التبويب لمدة 4 ثوانٍ مع بقاء الشريط عند 0%، ثم يقفز فجأة إلى 100%. كما يظهر متصفح Chrome رسالة "الصفحة لا تستجيب" (Page unresponsive) على الأجهزة البطيئة.

```js
async function importRows(rows, onProgress) {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    rows.slice(i, i + CHUNK).forEach(validateAndNormalize); // عمل معالجة ثقيل ومستهلك للـ CPU
    onProgress(Math.round(((i + CHUNK) / rows.length) * 100)); // تحديث الـ DOM
    await Promise.resolve(); // خطأ: هذا يجدول microtask فقط!
  }
}
```
سبب المشكلة: كل استدعاء لـ `await Promise.resolve()` يضع بقية الحلقة التكرارية في **طابور الـ Microtasks**. والمتصفح يفرغ الـ Microtasks بالكامل قبل أي محاولة تصيير، مما يحول الحلقة بالكامل إلى كتلة تزامنية واحدة طويلة تحجب المتصفح. لا تتم أي عملية رسم (Paint) ولا تستجيب النقرات حتى تنتهي الدورة بأكملها.

## How to fix it
قم بالتنازل عن مسار التنفيذ لصالح **مهمة حقيقية (Task / Macrotask)** حتى يتمكن المتصفح من التصيير واستقبال المدخلات بين الدفعات:

```js
// يفضل استخدام scheduler.yield() حيثما كان مدعوماً، مع الرجوع إلى macrotask كحل بديل.
function yieldToMain() {
  if (globalThis.scheduler?.yield) return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function importRows(rows, onProgress) {
  const CHUNK = 500;
  let deadline = performance.now() + 50; // الحفاظ على كل مهمة تحت حدود ~50 مللي ثانية

  for (let i = 0; i < rows.length; i += CHUNK) {
    rows.slice(i, i + CHUNK).forEach(validateAndNormalize);

    if (performance.now() >= deadline) {
      onProgress(Math.min(100, Math.round(((i + CHUNK) / rows.length) * 100)));
      await yieldToMain(); // ينهي المهمة الحالية: يتيح فرصة للـ render واستقبال المدخلات
      deadline = performance.now() + 50;
    }
  }
  onProgress(100);
}
```
سبب نجاح الحل: استدعاء `setTimeout` أو `scheduler.yield()` ينهي المهمة الحالية (Task). يستطيع الـ Event Loop حينها الانتقال لخطوة التصيير (يعيد رسم شريط التقدم) ومعالجة النقرات العالقة قبل بدء الدفعة التالية. كما يُعد `scheduler.yield()` أفضل من `setTimeout` لأن استمرارية التنفيذ تحتفظ بأولويتها ولا تتأخر خلف مهام أخرى أو قيود الحد الأدنى البالغة 4ms للمؤقتات المتداخلة.

بدائل أخرى: نقل معالجة البيانات إلى **Web Worker** (وهو الحل الأفضل للمهام المعقدة والمستهلكة للـ CPU). وبالنسبة للتحديثات البصرية، استخدم `requestAnimationFrame` لتتم الكتابة في الـ DOM بمعدل إطار واحد في كل مرة.

## How to say it in the interview
- "يُنفذ الـ Event Loop مهمة واحدة (Task)، ثم يفرغ **جميع** الـ Microtasks، وبعدها قد يقوم المتصفح بالتصيير (Render). وتُعتبر الـ Promises واستمرارية `await` من الـ Microtasks، لذا فهي تنفذ دائماً قبل أي `setTimeout` تالٍ وقبل عملية الـ Paint القادمة."
- فخ شائع: الاعتقاد بأن "`await` تجعل الكود غير حاجب (Non-blocking)". هذا غير صحيح؛ فهي تؤجل الكود فقط إلى Microtask. ولكي تسمح للمتصفح بالرسم، يجب أن تتنازل عن المهمة عبر **Task حقيقية** (`setTimeout` أو `MessageChannel` أو `scheduler.yield()`) أو تنقل العمليات الثقيلة إلى Web Worker.
- سؤال متابعة: "أين تُنفذ `requestAnimationFrame`؟": تُنفذ في خطوة التصيير مباشرة قبل حسابات style و layout و paint. وهي المكان المثالي للكتابة في الـ DOM للرسوم المتحركة، وتتوقف مؤقتاً في التبويبات الخلفية لتوفير الموارد.
- الموازنة (Trade-off): تقسيم العمل إلى دفعات صغيرة يجعل واجهة المستخدم أكثر استجابة، لكن إجمالي وقت العملية قد يزيد قليلاً بسبب تكلفة الجدولة (Scheduling overhead). تخصيص ميزانية زمنية لكل دفعة (~50ms) يوفر أفضل توازن.
