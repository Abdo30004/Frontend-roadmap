# كيف تقوم بتنقيح أخطاء (Debug) كود JavaScript وتطبيقات React بفعالية؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- كيف تقوم بتنقيح أخطاء تطبيقات JavaScript و React بفعالية؟

## The concept (short answer)
- تنقيح الأخطاء (Debugging) هو منهجية علمية منظمة وليس مجرد وضع عشوائي لدوال `console.log`: **إعادة إنتاج (reproduce)** المشكلة بشكل موثوق، **عزل (isolate)** مكان حدوثها، صياغة **فرضية (hypothesis)** واضحة، **التحقق (verify)** باستخدام الأدوات المتخصصة، إصلاح الخطأ، ثم كتابة اختبار يمنع تكراره.
- **أدوات مطوري المتصفح (Browser DevTools)** هي صندوق أدواتك الأساسي:
  - **الـ Console**: تفحص الأخطاء ومكدس الاستدعاءات (stack traces)، ودوال `console.table`، و `console.trace`، والتعبيرات اللحظية (live expressions).
  - **تبويب Sources**: نقاط التوقف (breakpoints)، ونقاط التوقف الشرطية (conditional breakpoints)، ونقاط التسجيل (logpoints)، وعبارة `debugger;`، والتنقل خطوة بخطوة (step over/into)، ومراقبة المتغيرات. وتسترجع ملفات الخرائط (Source maps) كودك الأصلي من الكود المضغوط.
  - **تبويب Network**: فحص رموز الحالة، وحمولات الطلبات، وأجسام الاستجابات، والتوقيت، وخنق سرعة الاتصال ("Slow 4G")، وتعطيل الكاش.
  - **تبويب Elements / Application**: فحص شجرة الـ DOM، وحسابات CSS، و localStorage، وملفات الكوكيز؛ وتبويب **Performance** لتشخيص بطء التصيير.
- **إضافة React DevTools**: تبويب Components لتفحص الـ props والـ state والـ hooks لأي مكون؛ وتبويب Profiler لمعرفة أي المكونات تعيد التصيير وسبب ذلك ("Highlight updates when components render").
- أدوات خاصة بـ React: وضع StrictMode (يشغل الـ effects مرتين في بيئة التطوير لكشف غياب دوال التنظيف)، وقاعدة `react-hooks/exhaustive-deps` في eslint، ومكونات حدود الأخطاء (error boundaries).
- في بيئة الإنتاج: مراقبة الأخطاء (عبر Sentry ونحوها) مع رفع ملفات source maps، بالإضافة إلى `git bisect` لمعرفة الإيداع الذي أدخل الخلل بدقة.

## Real-life example: the problem
حالة شائعة: في لوحة تحكم للدعم الفني، عندما ينقر وكيل الدعم سريعاً على التذكرة #101 ثم التذكرة #102، تعرض اللوحة أحياناً رسائل التذكرة #101 تحت ترويسة التذكرة #102! فأجاب الوكلاء على عملاء خاطئين. وضع مطور مبتدئ دوال `console.log` في كل مكان، فرأى أن "المعرف الصحيح يتم تمريره"، ولم يستطع إعادة إنتاج المشكلة على شبكة مكتبه السريعة.

```jsx
function TicketPanel({ ticketId }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    console.log("loading", ticketId);
    fetch(`/api/tickets/${ticketId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        console.log("got data");
        setMessages(data);       // الاستجابة التي تصل أخيراً هي من تفوز وتُعرض!
      });
  }, [ticketId]);

  return (
    <section>
      <h2>Ticket #{ticketId}</h2>
      {messages.map((m) => <Message key={m.id} {...m} />)}
    </section>
  );
}
```

## How to fix it
الخطوات المنهجية التي تكشف السبب الجذري:
1. **إعادة الإنتاج (Reproduce)**: تبويب Network في DevTools -> تقليل السرعة إلى "Slow 4G"، النقر على #101 ثم سريعاً على #102. الآن يتكرر الخطأ في كل مرة.
2. **الملاحظة (Observe)**: يوضح تبويب Network وجود طلبين قيد التنفيذ؛ طلب #101 يكتمل بعد طلب #102.
3. **التحقق (Verify)**: وضع logpoint (بالنقر بالزر الأيمن على رقم السطر -> "Add logpoint") عند سطر `setMessages` لطباعة `ticketId, data[0]?.ticketId`؛ فتطبع `102, 101`. وتظهر React DevTools أن `ticketId: 102` بينما الـ `messages` تعود للطلب 101.
4. **تأكيد الفرضية**: حالة تسابق (race condition)؛ فالـ effect لا يلغي الطلب القديم المعلق.

الحل: إلغاء الطلب السابق في دالة تنظيف الـ effect عبر `AbortController`.

```jsx
function TicketPanel({ ticketId }) {
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(`/api/tickets/${ticketId}/messages`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setMessages)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err);  // تجاهل خطأ الإلغاء المتعمد
      });

    return () => controller.abort();  // تعمل فور تغير ticketId أو عند إلغاء تركيب المكون
  }, [ticketId]);

  if (error) return <p role="alert">Could not load messages.</p>;
  return (
    <section>
      <h2>Ticket #{ticketId}</h2>
      {messages.map((m) => <Message key={m.id} {...m} />)}
    </section>
  );
}
```

لماذا ينجح هذا الحل: عندما تتغير قيمة `ticketId`، تشغل React دالة تنظيف الـ effect السابق أولاً، والتي تلغي الطلب القديم المعلق فوراً، مما يستحيل معه أن تقوم استجابة متأخرة للتذكرة #101 باستدعاء `setMessages`. كما أن الكود السابق لم يكن يتحقق من `res.ok`، فكان خطأ 500 سيعطل التطبيق عند استدعاء `.map` على كائن خطأ؛ وقد تم إصلاح ذلك أيضاً.

ثم نثبت الحل بكتابة اختبار انحدار (regression test) باستخدام RTL مع محاكاة تأخير الشبكة.

حلول بديلة: مكتبات مثل TanStack Query أو SWR تضع مفتاحاً للكاش بناءً على معرف التذكرة وتعالج حالات التسابق وإعادة المحاولة تلقائياً؛ كما يمكن استخدام مؤشر بسيط `let ignore = false` في دالة التنظيف إن تعذر الإلغاء.

أدوات مفيدة أخرى:

```js
debugger;                          // توقف التنفيذ فوراً عند فتح DevTools
console.table(rows);               // عرض مصفوفات الكائنات في جدول أنيق
console.trace("who called me?");   // طباعة مكدس الاستدعاءات لمعرفة مصدر النداء
// شرط لنقطة التوقف في Sources: order.total < 0
```

## How to say it in the interview
- "أبدأ دائماً بإعادة إنتاج الخطأ بشكل موثوق، ثم أعزله عبر أدوات DevTools: نقاط التوقف ومكدس الاستدعاءات في تبويب Sources، وتبويب Network لمشاكل الـ API، و React DevTools لفحص الـ props والـ state وإعادات التصيير. وبعد الإصلاح أضيف اختباراً يضمن عدم تكراره."
- اذكر قصة واقعية محددة مثل مشكلة الـ race condition السابقة: محاكاة بطء الشبكة لإعادة إنتاجها، ثم حلها باستخدام `AbortController` في دالة تنظيف الـ effect.
- سؤال المتابعة: "كيف تنقح الأخطاء في بيئة الإنتاج؟" عبر أدوات مراقبة الأخطاء (Error monitoring) مع رفع ملفات الخرائط (source maps)، والسجلات المعززة بالسياق (المستخدم، المسار، الإصدار)، وأعلام الميزات، واستخدام `git bisect` لعزل التعديل المسبب للخلل.
- المفاضلة: `console.log` سريعة للحالات البسيطة، لكن نقاط التوقف تتيح فحص المتغيرات الحية دون تعديل الكود وإعادة نشره؛ مع الحرص على تنظيف السجلات الزائدة قبل دمج الكود عبر قاعدة `no-console`.
