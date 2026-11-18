# ما هي إمكانية الوصول إلى الويب (Accessibility / a11y) وكيف تطبقها؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- ما هي إمكانية الوصول إلى الويب (a11y)؟
- ما هي معايير إمكانية الوصول إلى الويب (WCAG) وكيف تطبقها؟

## The concept (short answer)
- تعني إمكانية الوصول (Accessibility / a11y) تمكين الأشخاص ذوي الإعاقة (البصرية، السمعية، الحركية، أو الإدراكية) من إدراك تطبيقك واستخدامه وفهمه، غالباً عبر التقنيات المساعدة مثل قارئات الشاشة (screen readers)، أو التنقل بلوحة المفاتيح فقط، أو التحكم الصوتي، أو تكبير الشاشة.
- معايير **WCAG** (إرشادات نفاذ محتوى الويب، أحدث إصدار 2.2) هي المرجع العالمي. وتتمحور حول مبادئ **POUR**: قابل للإدراك (Perceivable)، قابل للتشغيل (Operable)، قابل للفهم (Understandable)، ومتين (Robust). والمستوى **AA** هو الهدف القانوني والتعاقدي المعتاد.
- أكبر المكاسب تأتي من استخدام **عناصر HTML الدلالية (Semantic HTML)**: `<button>`، `<a href>`، `<label>`، `<nav>`، `<main>`، مع ترتيب متسلسل للعناوين. وتمنحك العناصر الأصلية دعماً تلقائياً للوحة المفاتيح والتركيز وأدوار قارئات الشاشة دون أي كود إضافي.
- الفحوصات الأساسية: النصوص البديلة (`alt`)، تباين الألوان (4.5:1 للنصوص العادية)، حلقة تركيز مرئية (visible focus)، إمكانية استخدام كل شيء بلوحة المفاتيح، ربط تسميات النماذج وتنبيهات الأخطاء برمجياً، وعدم نقل المعلومات عبر اللون بمفرده.
- تسد سمات **ARIA** الفجوات (مثل `aria-live` و `aria-expanded`)، ولكن القاعدة الذهبية الأولى لـ ARIA هي: لا تستخدم ARIA إذا كان هناك عنصر أصلي يؤدي المهمة؛ فاستخدام ARIA الخاطئ أسوأ بكثير من عدم استخدامها.
- الاختبار بالأدوات التلقائية (axe DevTools، Lighthouse، eslint-plugin-jsx-a11y) بالإضافة إلى الاختبار اليدوي عبر لوحة المفاتيح وقارئات الشاشة؛ فالأدوات التلقائية تكشف ثلث المشاكل فقط.

## Real-life example: the problem
حالة شائعة: نموذج "تحويل الأموال" في موقع بنك يجتاز مراجعة التصميم، ولكن عميلاً كفيفاً يستخدم قارئ شاشة وعميلاً يتنقل بلوحة المفاتيح بسبب إعاقة حركية يعجزان معاً عن إتمام التحويل:
- زر الإرسال عبارة عن وسم `div`، لذا يتخطاه مفتاح Tab ولا يفعل مفتاح Enter أي شيء.
- حقول الإدخال تحتوي على نصوص توضيحية مؤقتة (placeholders) فقط دون تسميات حقيقية، فينطق قارئ الشاشة "edit text, blank".
- يظهر الخطأ كنص أحمر لا تقرأه قارئات الشاشة نهائياً.
- ألغى المصمم خطوط التركيز الخارجية (focus outlines) لأنها "تبدو قبيحة".

```jsx
function TransferForm({ onSubmit }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="form">
      <input placeholder="Amount" value={amount}
             onChange={(e) => setAmount(e.target.value)} />
      <input placeholder="IBAN" />
      {error && <span style={{ color: "red" }}>{error}</span>}
      <div className="btn" onClick={() => {
        if (!amount) setError("Required");
        else onSubmit(amount);
      }}>
        <img src="/icons/send.svg" />
      </div>
    </div>
  );
}
```

```css
*:focus { outline: none; }
.form input::placeholder { color: #c8c8c8; } /* تباين ضعيف جداً بنسبة 1.6:1 */
```

## How to fix it
```jsx
import { useId, useState } from "react";

function TransferForm({ onSubmit }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const amountId = useId();
  const errorId = useId();

  function handleSubmit(e) {
    e.preventDefault();                       // نموذج أصلي: مفتاح Enter يعمل تلقائياً
    if (!amount) {
      setError("Enter an amount to transfer.");
      return;
    }
    setError("");
    onSubmit(amount);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2>Transfer money</h2>

      <label htmlFor={amountId}>Amount (EUR)</label>
      <input
        id={amountId}
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      <p id={errorId} role="alert">{error}</p>

      <label htmlFor="iban">Recipient IBAN</label>
      <input id="iban" name="iban" autoComplete="off" />

      <button type="submit">
        <img src="/icons/send.svg" alt="" /> Send transfer
      </button>
    </form>
  );
}
```

```css
/* الإبقاء على مؤشر التركيز مرئياً لمستخدمي لوحة المفاتيح فقط */
:focus-visible {
  outline: 3px solid #1a5fb4;
  outline-offset: 2px;
}
.error { color: #b00020; } /* تباين 4.5:1+ على الخلفية البيضاء، مع أيقونة أو نص وليس اللون فقط */
```

لماذا ينجح هذا الحل:
- يمنح وسم `<form>` مع `<button type="submit">` تنقلاً سلساً بـ Tab، وتفعيلاً بـ Enter و Space، ودور "button" دون كتابة أي جافاسكريبت إضافي.
- وسم `<label htmlFor>` يجعل قارئ الشاشة ينطق "Amount (EUR), edit text"، كما أن النقر على التسمية يوجه المؤشر فوراً داخل الحقل.
- السمة `role="alert"` تعلن رسالة الخطأ فور ظهورها؛ وتقوم `aria-describedby` بإعادة قراءتها عند التركيز على الحقل؛ وتوضح `aria-invalid` أن الحقل يحتوي قيمة خاطئة.
- الأيقونة التزيينية تحتوي على `alt=""` ليتجاهلها قارئ الشاشة؛ ويحتوي الزر على نص مرئي كاسم يمكن الوصول إليه.
- المحدد `:focus-visible` يُظهر حلقة تركيز واضحة لمستخدمي لوحة المفاتيح دون إظهارها عند النقر بالفأرة.

حلول بديلة: للعناصر المعقدة (النوافذ المنبثقة modals، القوائم المنسدلة comboboxes، والتبويبات tabs)، استخدم مكتبات غير مقيدة بالمظهر مثل Radix UI أو React Aria بدلاً من بناء مصائد التركيز (focus traps) و ARIA المعقدة يدوياً.

## How to say it in the interview
- "إمكانية الوصول تعني جعل التطبيق متاحاً للجميع، بما في ذلك مستخدمو لوحة المفاتيح وقارئات الشاشة. أستهدف معايير WCAG 2.2 AA وأبدأ دائماً بـ Semantic HTML لأن العناصر الأصلية توفر دعم لوحة المفاتيح وقارئات الشاشة مجاناً."
- اذكر الفحوصات العملية: التسميات (labels)، النصوص البديلة (alt)، تباين الألوان 4.5:1، حلقة التركيز المرئية، مسار كامل بلوحة المفاتيح، إعلان الأخطاء صوتياً، والاختبار بأدوات axe و Lighthouse مع قارئ شاشة حقيقي (VoiceOver أو NVDA).
- فخ المقابلة: القول "أضيف `role="button"` إلى عنصر div". سؤال المتابعة: ستحتاج حينها لإضافة `tabIndex={0}` ومعالجة Enter و Space يدوياً، وهو السبب الذي يدفعك ببساطة لاستخدام `<button>`.
- المفاضلة: بناء مكونات مخصصة بالكامل يكلف جهداً كبيراً في ضبط ARIA والتركيز؛ لذا فإن الاعتماد على مكتبات مكونات تدعم إمكانية الوصول يوفر الكثير من الوقت والمخاطر القانونية.
