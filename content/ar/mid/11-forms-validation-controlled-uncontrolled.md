# كيف تتعامل مع النماذج والتحقق من صحتها في React؟ المكونات الموجهة (Controlled) مقابل غير الموجهة (Uncontrolled)

**Level:** Mid
**Merged from (original phrasings):**
- كيف تدير النماذج (Forms) وعمليات التحقق من البيانات (Validation) في React؟
- المكونات الموجهة (Controlled) مقابل غير الموجهة (Uncontrolled): متى تستخدم كلاً منها؟

## The concept
- **المكونات الموجهة (Controlled)**: تكون حالة React هي المصدر الوحيد للحقيقة (Single source of truth) عبر خاصيتي `value` و `onChange`. كل ضربة زر تحدث الـ State وتعيد تصيير المكون. ممتازة للاستجابة اللحظية: مثل التنسيق الحي لأرقام البطاقات، والحقول المعتمدة على حقول أخرى، وتفعيل الأزرار، والبحث المباشر أثناء الكتابة.
- **المكونات غير الموجهة (Uncontrolled)**: يحتفظ الـ DOM نفسه بالقيمة مباشرة (عبر `defaultValue`، وتُقرأ القيمة لاحقاً عبر `ref` أو عبر كائن `FormData` عند إرسال النموذج). لا تحدث أي عمليات إعادة تصيير مع ضربات المفاتيح. ممتازة للنماذج البسيطة أو الضخمة، وحقول رفع الملفات (عنصر `<input type="file">` غير موجه دوماً)، ومع نموذج Form Actions في React 19.‏
- طبقات التحقق من صحة البيانات: تبدأ بأساسيات HTML الأصلية (`required`، `type="email"`، `pattern`)، ثم استخدام **مخطط بيانات صريح (Schema)** عبر مكتبات مثل Zod أو Yup لقواعد الأعمال الحقيقية، مع **إلزامية التحقق على جانب الخادم (Server-side validation) دوماً**، لأن فحوصات الواجهة الأمامية يمكن تجاوزها بسهولة.
- تجربة مستخدم مثالية (Good UX): أظهر أخطاء التحقق عند مغادرة الحقل (`onBlur` / `onTouched`) أو عند الإرسال (وليس مع أول حرف يكتبه المستخدم)، واعرض رسائل الخطأ بجانب الحقل المعني، واربطها بالـ accessibility عبر `aria-invalid` و `aria-describedby`، وانقل التركيز (Focus) لأول حقل غير صالح، وامنع الإرسال المكرر، واعرض أخطاء الخادم بدقة.
- الحل الإنتاجي المعتمد في الشركات: **react-hook-form** (يسجل الحقول غير الموجهة عبر الـ refs لتفادي إعادة التصيير) مع **Zod** (مخطط واحد يحدد الأنواع وقواعد التحقق ويُعاد استخدامه على الخادم).‏
- خطأ شائع: تحويل الحقل من غير موجه إلى موجه أثناء التشغيل (مثل تمرير `value={undefined}` ثم قيمة نصية). يحذر React من ذلك؛ لذا ابدأ دوماً بقيمة ابتدائية فارغة `''`.‏

## Real-life example
نموذج تسجيل لشركات B2B يحتوي على 15 حقلاً (اسم الشركة، والرقم الضريبي، والعنوان، وكلمة المرور، وغيرها). بُني النموذج بالكامل بطريقة المكونات الموجهة (Controlled) عبر كائن `useState` واحد ودوال تحقق يدوية. اشتكى المستخدمون من بطء ملحوظ أثناء الكتابة على الأجهزة القديمة، وظهور رسائل خطأ مزعجة أثناء كتابة البريد وقبل الانتهاء منه، وإرسال قائمة "حجم الشركة" كنص `"50"` بدلاً من رقم، ووصول أرقام ضريبية تالفة لقاعدة البيانات لأن فحصها سقط سهواً من شروط الـ `if`.‏

```jsx
function SignupForm() {
  const [form, setForm] = useState({ email: '', password: '', companySize: '', vat: '' /* ...11 حقل آخر */ });
  const [errors, setErrors] = useState({});

  const onChange = (e) => {
    const next = { ...form, [e.target.name]: e.target.value };
    setForm(next);                 // يُعاد تصيير النموذج كاملاً بـ 15 حقلاً مع كل ضربة زر!
    setErrors(validate(next));     // تظهر الأخطاء بينما لا يزال المستخدم يكتب أول حرف
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    await fetch('/api/signup', { method: 'POST', body: JSON.stringify(form) }); // لا يوجد منع للإرسال المكرر
  };

  return (
    <form onSubmit={onSubmit}>
      <input name="email" value={form.email} onChange={onChange} />
      {errors.email && <span>{errors.email}</span>}            {/* غير مرتبط بالحقل عبر accessibility */}
      <select name="companySize" value={form.companySize} onChange={onChange}>...</select>
      {/* ...13 حقلاً إضافياً */}
      <button>Create account</button>
    </form>
  );
}

function validate(f) {
  const e = {};
  if (!f.email.includes('@')) e.email = 'Invalid email';
  if (f.password.length < 8) e.password = 'Too short';
  return e; // نسيان التحقق من الرقم الضريبي وحجم الشركة تماماً
}
```

## How to fix it
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// مخطط موحد: القواعد والأنواع البرمجية لـ TypeScript، ويتم استيراد نفس المخطط في مسار الـ API بالخادم
export const signupSchema = z.object({
  email: z.string().email('أدخل بريد عمل صحيح'),
  password: z.string().min(12, 'كلمة المرور يجب ألا تقل عن 12 حرفاً'),
  companySize: z.coerce.number().int().min(1, 'اختر حجم الشركة'),
  vat: z.string().regex(/^[A-Z]{2}[0-9A-Z]{8,12}$/, 'رقم ضريبي غير صالح').optional().or(z.literal('')),
});
type SignupInput = z.infer<typeof signupSchema>;

export function SignupForm() {
  const {
    register, handleSubmit, setError, setFocus,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema), mode: 'onTouched' });

  const onSubmit = async (data: SignupInput) => {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.status === 409) {
      setError('email', { message: 'يوجد حساب مسجل بهذا البريد مسبقاً' });
      setFocus('email');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <label htmlFor="email">بريد العمل</label>
      <input id="email" type="email" {...register('email')}
             aria-invalid={!!errors.email} aria-describedby="email-error" />
      {errors.email && <p id="email-error" role="alert">{errors.email.message}</p>}

      <label htmlFor="companySize">حجم الشركة</label>
      <select id="companySize" {...register('companySize')} defaultValue="">
        <option value="" disabled>اختر...</option>
        <option value="10">1-10</option>
        <option value="50">11-50</option>
      </select>
      {errors.companySize && <p role="alert">{errors.companySize.message}</p>}

      {/* حقول كلمة المرور والرقم الضريبي تتبع نفس النمط */}
      <button disabled={isSubmitting}>{isSubmitting ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}</button>
    </form>
  );
}
```
سبب نجاح الحل: تسجل مكتبة react-hook-form المدخلات بطريقة **غير موجهة (Uncontrolled)** عبر الـ refs، لذلك لا تتسبب ضربات المفاتيح في إعادة تصيير النموذج. ويضمن خيار `mode: 'onTouched'` عدم إظهار الأخطاء إلا بعد مغادرة الحقل وليس أثناء الكتابة الأولى. ويوفر مخطط Zod فحصاً شاملاً في مكان واحد، ويحول `companySize` إلى رقم، وينشئ أنواع TypeScript متوافقة تماماً مع الخادم. كما أصبحت رسائل الخطأ متوافقة مع إمكانية الوصول، وحالت خاصية `isSubmitting` دون تكرار الإرسال، مع توجيه التركيز التلقائي لأول حقل غير صالح عند الإرسال.

بدائل أخرى: للنماذج البسيطة، يمكن الاكتفاء بـ `<form action={action}>` غير موجه بالكامل مع `useActionState` في React 19 أو Server Actions في Next.js وقراءة البيانات عبر `FormData` دون الحاجة لمكتبات إضافية. واستخدم المكونات الموجهة فقط للحقول التي تحتاج سلوكاً لحظياً (كتنسيق رقم بطاقة الائتمان)، وتدعمه مكتبة react-hook-form عبر مكون `Controller`.‏

## How to say it in the interview
- "المكونات الموجهة (Controlled) تعني أن حالة React هي مالكة القيمة: ممتازة للتفاعل اللحظي، لكنها تعيد التصيير مع كل ضربة زر. المكونات غير الموجهة (Uncontrolled) تعني أن الـ DOM هو مالك القيمة ونقرؤها عند الإرسال: أسرع وأبسط للنماذج الكبيرة."
- "في التطبيقات الإنتاجية أستخدم react-hook-form مع مخطط Zod، وأعيد التحقق بنفس المخطط على الخادم، لأن التحقق في جانب العميل هو لتحسين تجربة المستخدم فقط وليس للأمان."
- فخ شائع: الاعتقاد بأن "التحقق في جانب العميل كافٍ". هذا خطأ فادح، فأي شخص يستطيع إرسال طلب تالف مباشرة عبر أدوات مثل curl أو Postman.‏
- الموازنة (Trade-off): توفر المكونات الموجهة تحكماً أسهل ونموذجاً ذهنياً بسيطاً للنماذج الصغيرة، بينما تتفوق المكونات غير الموجهة في الأداء وقابلية التوسع للنماذج الكبيرة.
