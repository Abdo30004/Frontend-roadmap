# ما هو تفويض الأحداث (Event Delegation) في JavaScript وكيف يعمل؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- ما هي مستمعات الأحداث (Event Listeners)؟ وكيف تعمل؟

## The concept (short answer)
- **مستمع الأحداث (event listener)** هو دالة تقوم بتسجيلها على عنصر في شجرة الـ DOM باستخدام `element.addEventListener(type, handler, options)`. وعند وقوع الحدث (مثل النقر click، أو الإدخال input، أو الإرسال submit، أو الضغط على المفاتيح keydown)، يستدعي المتصفح المعالج مع تمرير **كائن الحدث (event object)**.
- ينتقل الحدث عبر 3 مراحل: **مرحلة الالتقاط (capturing)** (من كائن `window` نزولاً إلى العنصر المستهدف)، ثم **مرحلة الهدف (target)**، ثم **مرحلة الصعود أو الفقاعة (bubbling)** (من العنصر المستهدف صعوداً إلى `window`). وتعمل المستمعات افتراضياً في مرحلة الـ bubbling؛ ولتشغيلها أثناء الـ capturing نمرر `{ capture: true }`.
- يمثل `event.target` العنصر الذي تم النقر عليه فعلياً؛ بينما يمثل `event.currentTarget` العنصر المرفق به مستمع الحدث حالياً.
- توقف `event.stopPropagation()` انتقال الحدث وصعوده إلى العناصر الأعلى. بينما تلغي `event.preventDefault()` السلوك الافتراضي للمتصفح (مثل إرسال النموذج أو الانتقال بالرابط). وهما أمران مختلفان تماماً.
- **تفويض الأحداث (Event delegation):** نظراً لأن الأحداث تصعد إلى الأعلى (bubble up)، يمكنك وضع مستمع **واحد فقط** على العنصر الأب واستخدام `event.target.closest(selector)` لمعرفة أي عنصر ابن تم النقر عليه. يقلل هذا استهلاك الذاكرة ويعمل تلقائياً مع العناصر التي تُضاف إلى الصفحة **لاحقاً**.
- لإزالة المستمعات، استخدم `removeEventListener` (مع تمرير نفس مرجع الدالة تماماً) أو إشارة `AbortController`. ومن الخيارات المهمة: `{ once: true }` للتنفيذ مرة واحدة، و `{ passive: true }` لتحسين أداء أحداث التمرير واللمس.

```js
button.addEventListener('click', (event) => {
  console.log(event.target, event.currentTarget);
});
```

## Real-life example: the problem
تخيّل صندوق البريد الوارد لتطبيق بريد ويب. يحتوي كل صف رسالة على زر حذف "Delete". عملت أول 50 رسالة بنجاح، ولكن الرسائل التي تم تحميلها لاحقاً عبر **التمرير اللانهائي (infinite scroll)** (أو الرسائل الجديدة الواردة لحظياً) كانت تحتوي على **أزرار حذف لا تستجيب نهائياً**. بالإضافة إلى ذلك، أصبحت الصفحة أبطأ بمرور الوقت: فمع كل "تحديث" للصفحة كانت المستمعات تُعاد إضافتها مراراً، مما جعل بعض النقرات تُرسل طلب الحذف **مرتين**.

```js
// BROKEN: inbox.js
const list = document.querySelector('#inbox');

function attachDeleteHandlers() {
  document.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      deleteEmail(btn.dataset.id);   // تعمل مرة لكل مستمع مضاف
    });
  });
}

renderEmails(list, firstPage);
attachDeleteHandlers();              // الأزرار الحالية فقط هي من تحصل على مستمع

async function loadMore() {
  const next = await fetchNextPage();
  appendEmails(list, next);          // أزرار جديدة: بلا مستمع -> لا تستجيب
}

async function refresh() {
  renderEmails(list, await fetchFirstPage());
  attachDeleteHandlers();            // الأزرار التي بقيت تحصل على مستمع ثانٍ مكرر
}
```

## How to fix it
استخدم تفويض الأحداث: مستمع واحد على حاوية القائمة يعالج النقرات لجميع الصفوف الحالية والمستقبلية.

```js
// FIXED: inbox.js
const list = document.querySelector('#inbox');

// مستمع واحد، يُربط مرة واحدة، لجميع الصفوف (حالياً ومستقبلاً)
list.addEventListener('click', (event) => {
  // تعمل closest() بنجاح حتى لو نقر المستخدم على أيقونة الـ <svg> داخل الزر
  const deleteBtn = event.target.closest('.delete-btn');
  if (deleteBtn) {
    deleteEmail(deleteBtn.dataset.id);
    return;                          // إنهاء التنفيذ لعدم فتح الرسالة أيضاً
  }

  const row = event.target.closest('.email-row');
  if (row) openEmail(row.dataset.id);
});

renderEmails(list, firstPage);

async function loadMore() {
  appendEmails(list, await fetchNextPage()); // الصفوف الجديدة تعمل تلقائياً دون أي كود إضافي
}

async function refresh() {
  renderEmails(list, await fetchFirstPage()); // لا إعادة ربط، ولا تكرار للأحداث
}
```

لماذا ينجح هذا الحل: تصعد نقرات أي عنصر `.delete-btn` إلى الحاوية الرئيسية `#inbox`، حيث يلتقطها المستمع الوحيد. ونظراً لأنه مربوط **مرة واحدة فقط**، لا توجد أي استدعاءات مكررة، ولا يكترث المستمع بوقت إنشاء الصفوف في شجرة الـ DOM. ويضمن التحقق من زر الحذف أولاً والإنهاء المبكر بـ `return` عدم فتح الرسالة عند الضغط على زر الحذف.

ملاحظة هامة: توقف `stopPropagation()` وصول الحدث إلى **العناصر الأب** فقط؛ ولا تمنع المستمعات الأخرى المسجلة على نفس العنصر. ولهذا السبب فإن معالجاً واحداً مدمجاً مع `return` مبكر هو خيار أكثر نظافة من تسجيل مستمعين منفصلين على `#inbox`.

تنظيف المستمعات (عند إتلاف عنصر أو مغادرة الصفحة مثلاً):

```js
const controller = new AbortController();
window.addEventListener('resize', onResize, { signal: controller.signal });
window.addEventListener('scroll', onScroll, { passive: true, signal: controller.signal });
controller.abort(); // يزيل كلا المستمعين دفعة واحدة
```

في React، نادراً ما تقوم بذلك يدوياً: فالـ props مثل `onClick` تستخدم التفويض داخلياً عند جذر التطبيق، وللمستمعات على `window` أو `document` تضيفها داخل `useEffect` وتزيلها في دالة التنظيف (cleanup).

## How to say it in the interview
- "ينتقل الحدث نزولاً في مرحلة الالتقاط (capturing)، ويصل إلى العنصر الهدف (target)، ثم يصعد إلى الأعلى في مرحلة الفقاعة (bubbling). وتعمل المستمعات افتراضياً في مرحلة الـ bubbling، وهو ما يجعل تفويض الأحداث ممكناً."
- "مع تفويض الأحداث، أربط مستمعاً واحداً بالعنصر الأب وأستخدم `event.target.closest()` للتعرف على العنصر المقصود. هذا الأسلوب يعمل مع العناصر المضافة مستقبلاً ويوفر مئات المستمعات في الذاكرة."
- فخ المقابلة: تتطلب `removeEventListener` **نفس مرجع الدالة تماماً**؛ ولا يمكن إزالة الدوال السهمية المكتوبة مباشرة في السطر (inline arrow functions). استخدم دالة مسماة أو إشارة `AbortController`.
- المفاضلة: بعض الأحداث لا تصعد للأعلى (لا تدعم الـ bubbling) مثل `focus` و `blur` و `mouseenter`؛ وفي هذه الحالة نستخدم أحداث `focusin` و `focusout` و `mouseover` عند الحاجة للتفويض. كما أن الإفراط في استخدام `stopPropagation` قد يُعطل مكتبات التحليلات أو ميزات إغلاق القوائم عند النقر في الخارج (click outside).
