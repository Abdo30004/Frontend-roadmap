# ما الفرق بين useEffect و useLayoutEffect؟

**Level:** Mid
**Merged from (original phrasings):**
- ما الفرق بين "useEffect" و "useLayoutEffect"؟

## The concept
- كلاهما يُنفذ بعد أن يقوم React بتطبيق التغييرات (Commit) على الـ DOM. الفرق الجوهري يكمن في **توقيت التنفيذ بالنسبة لعملية رسم المتصفح (Browser Paint)**.
- يُنفذ `useLayoutEffect` **بشكل تزامني بعد تعديلات الـ DOM وقبل أن يقوم المتصفح بالرسم على الشاشة**. إذا قمت بتحديث الـ State داخله، يقوم React بإعادة التصيير تزامناً، ولن يرى المستخدم سوى النتيجة النهائية المعدلة. وهو يحجب عملية الرسم (Blocks painting).
- يُنفذ `useEffect` **بعد عملية الرسم (Paint)** في المعتاد. قد يرى المستخدم للحظة خاطفة النسخة الأولى من الواجهة قبل أن يغيرها الـ Effect، مما يسبب وميضاً أو قفزة بصرية (Flicker) إذا كان الـ Effect يعدل تخطيط الصفحة (Layout).
- القاعدة الأساسية: استخدم `useEffect` افتراضياً (لجلب البيانات، والاشتراكات، والسجلات، والمؤقتات). واستخدم `useLayoutEffect` فقط عندما تحتاج إلى **أخذ قياسات من الـ DOM وتعديلها قبل أن يراها المستخدم**: مثل ضبط موضع التلميحات (Tooltips / Popovers)، واستعادة موضع التمرير، وتحجيم العناصر تلقائياً، وتثبيت موضع التمرير في غرف الدردشة.
- الترتيب أثناء الـ Commit: تحديث الـ DOM -> تنفيذ دوال تنظيف layout effects ثم layout effects -> عملية الرسم (Paint) -> تنفيذ دوال تنظيف passive effects ثم effects.
- لا يُنفذ `useLayoutEffect` أثناء التصيير على الخادم (SSR). وتظهر المشكلة في أن كود الـ HTML القادم من الخادم يفتقر لأبعاد الشاشة الحقيقية، لذا يجب أن تعرض المكونات التي تعتمد على القياسات واجهة بديلة (Fallback) أولاً.
- وُجد خطاف `useInsertionEffect` خصيصاً لمكتبات CSS-in-JS لحقن الأنماط قبل layout effects، ونادراً جداً ما يحتاجه كود التطبيق العادي.

## Real-life example
في لوحة تحليلات SaaS، يؤدي تمرير المؤشر فوق نقطة بيانية إلى ظهور تلميح (Tooltip). إذا كان التلميح سيتجاوز الحافة اليمنى للشاشة، فيجب قلبه ليظهر على الجانب الأيسر. لاحظ المستخدمون أن التلميح يظهر على اليمين لجزء من الثانية ثم يقفز فجأة إلى اليسار. أطلق فريق اختبار الجودة (QA) على هذا الخلل "التلميح القافز"، وهو مزعج جداً وواضح على الأجهزة البطيئة.

```jsx
function Tooltip({ anchorRect, children }) {
  const ref = useRef(null);
  const [left, setLeft] = useState(anchorRect.right + 8);

  useEffect(() => {
    // خطأ: ينفذ بعد أن قام المتصفح برسم التلميح بالفعل في الموضع القديم!
    const { width } = ref.current.getBoundingClientRect();
    if (anchorRect.right + 8 + width > window.innerWidth) {
      setLeft(anchorRect.left - width - 8);
    }
  }, [anchorRect]);

  return (
    <div ref={ref} className="tooltip" style={{ position: 'fixed', top: anchorRect.top, left }}>
      {children}
    </div>
  );
}
```
ما يحدث خلف الكواليس: التصيير 1 -> الـ Commit -> **الرسم Paint (يظهر التلميح على اليمين متجاوزاً الشاشة)** -> الـ Effect يقيس الأبعاد -> استدعاء setLeft -> التصيير 2 -> الرسم Paint (ينتقل التلميح إلى اليسار). يشاهد المستخدم إطارين مختلفين ويحدث الوميض.

## How to fix it
```jsx
import { useLayoutEffect, useRef, useState } from 'react';

function Tooltip({ anchorRect, children }) {
  const ref = useRef(null);
  const [left, setLeft] = useState(anchorRect.right + 8);

  useLayoutEffect(() => {
    // ينفذ بعد تحديث الـ DOM ولكن قبل عملية الرسم Paint. وتتم إعادة التصيير تزامناً.
    const { width } = ref.current.getBoundingClientRect();
    const fitsRight = anchorRect.right + 8 + width <= window.innerWidth;
    setLeft(fitsRight ? anchorRect.right + 8 : anchorRect.left - width - 8);
  }, [anchorRect]);

  return (
    <div ref={ref} className="tooltip" style={{ position: 'fixed', top: anchorRect.top, left }}>
      {children}
    </div>
  );
}
```
سبب نجاح الحل: يُنفذ React خطاف `useLayoutEffect` قبل أن تتاح للمتصفح أي فرصة لرسم البكسلات على الشاشة. وتتم معالجة تحديث الحالة بداخله بشكل تزامني، لذلك فإن أول إطار يراه المستخدم يكون بالفعل في الموضع الصحيح دون أي وميض أو قفزة بصرية.

حلول بديلة: لحساب المواضع بالتحديد، استخدم مكتبات متخصصة مثل Floating UI (تتكفل بحسابات الانقلاب والإزاحة والتمرير)، أو خاصية CSS anchor positioning متى ما توفر دعم المتصفحات لها. وفي صفحات الـ SSR، صيّر التلميح على جانب العميل فقط (فهو يظهر عند التمرير على أية حال)، لتجنب أي تعارض في القياسات بين الخادم والعميل.

### حالة كلاسيكية ثانية: تثبيت التمرير في المحادثات (Chat Scroll Anchoring)
```jsx
useLayoutEffect(() => {
  const el = listRef.current;
  // إبقاء المستخدم في أسفل المحادثة عند وصول رسائل جديدة دون قفزة مرئية مزعجة
  if (wasAtBottomRef.current) el.scrollTop = el.scrollHeight;
}, [messages]);
```

## How to say it in the interview
- "يُنفذ `useEffect` بعد عملية الرسم ولا يحجبها. بينما يُنفذ `useLayoutEffect` بعد تحديث الـ DOM ولكن قبل الرسم مباشرة، ولذلك استخدمه فقط لأخذ قياسات الـ DOM وتعديلها لمنع حدوث وميض مرئي (Flicker)."
- فخ شائع: وضع طلبات جلب البيانات أو العمليات الثقيلة داخل `useLayoutEffect`. يؤدي هذا إلى تأخير رسم الشاشة ويجعل التطبيق يبدو بطيئاً؛ يجب أن يبقى كوده قصيراً وخفيفاً جداً.
- سؤال متابعة: "هل ينفذ `useEffect` دائماً بعد الرسم؟": في العادة نعم، ولكن إذا كان التحديث ناتجاً عن حدث مستخدم منفصل (مثل نقرة زر) أو قامت دالة layout effect بتحديث الـ state، فقد يقوم React بإفراغ الـ passive effects قبل الرسم. لذا لا تعتمد على توقيت `useEffect` لضمان دقة المظهر البصري.
- الموازنة (Trade-off): يوفر `useLayoutEffect` دقة واستقراراً بصرياً على حساب حجب إطار الرسم مؤقتاً. ومع تقنيات الـ SSR لا يمكن تشغيله على الخادم، مما يعني أن أول HTML مرسل قد يختلف عن النتيجة المقاسة على العميل.
