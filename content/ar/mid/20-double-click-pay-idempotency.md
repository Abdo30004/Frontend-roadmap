# المستخدم ينقر نقراً مزدوجاً على زر "دفع": كيف تمنع إرسال الطلب المكرر (Idempotency)؟

**Level:** Mid
**Merged from (original phrasings):**
- المستخدم ينقر نقراً مزدوجاً على زر "Pay" (دفع): كيف تمنع تكرار طلب الدفع؟

## The concept
- **طبقتان للحماية، وكلاهما إلزامي ولا غنى لأحدهما عن الآخر:**
  1. **على جانب العميل (Client-side)**: منع إرسال النموذج مرة ثانية باستخدام صمام أمان متزامن (Synchronous guard عبر `useRef` يتم تفعيله في السطر الأول من المعالج، قبل أي استدعاء `await`). لأن خاصية `disabled={loading}` لا تسري إلا بعد اكتمال دورة إعادة التصيير، وأي `await` يسبق `setLoading(true)` (مثل فحص السلة أو تجديد رمز المصادقة) يترك نافذة زمنية تسمح بنفاذ النقرة الثانية. بالإضافة إلى تعطيل الزر وإظهار عبارة "جارٍ المعالجة...".
  2. **على جانب الخادم (Server-side)**: جعل العملية **حيادية التأثير (Idempotent)** باستخدام **مفتاح حيادية العملية (Idempotency Key)**. يولد العميل مفتاحاً فريداً (`crypto.randomUUID()`) مرة واحدة لكل محاولة دفع، ويرفقه مع كل محاولة وإعادة إرسال. يخزن الخادم المفتاح ونتيجته، فإذا استلم نفس المفتاح مجدداً يُرجع النتيجة الأصلية المحفوظة بدلاً من خصم المبلغ مرة ثانية!
- **لماذا لا يكفي حل الواجهة الأمامية وحده؟**: لأن إعادة محاولة طلبات الشبكة المنقطعة، وإعادة تحديث الصفحة (Refresh)، والضغط على زر الرجوع ثم الإرسال، وفتح المعاملة في تبويبين، واستخدام أدوات مثل curl؛ كل هذه الحالات تتجاوز حماية المتصفح تماماً. والخادم هو الجهة الوحيدة القادرة على ضمان "خصم المبلغ لمرة واحدة بالضبط".
- تدعم بوابات الدفع العالمية هذه الميزة تلقائياً (مثل هيدر `Idempotency-Key` في Stripe). ويجب أن تدعم واجهاتك الخلفية نفس النمط لكل عمليات الـ POST الحساسة (الطلبات، والتحويلات المالية، والحجوزات).
- ملاحظة: استخدام الـ Debounce أو الـ Throttle **ليس** الحل الصحيح إطلاقاً هنا؛ فهما يؤجلان أو يسقطان النقرات استناداً للوقت فقط دون أي ضمان حقيقي لصحة المعاملة.

## Real-life example
في موقع لبيع تذاكر الحفلات أثناء فترة الحجز المسبق، عانت بوابة الدفع من بطء شديد (4-6 ثوانٍ). ضغط المستخدمون نقراً مزدوجاً على زر "دفع" أو كرروا النقر لعدم ظهور أي استجابة فورية. استلم فريق الدعم الفني عشرات الشكاوى من عملاء تم الخصم منهم مرتين لنفس التذاكر، وارتفعت طلبات استرداد الأموال والنزاعات البنكية (Chargebacks). كان المطور قد وضع `disabled={loading}`، ومع ذلك تكرر الخصم! والسبب: كان المعالج ينتظر أولاً فحص السلة عبر `await api.get(...)` (~300ms) قبل تفعيل `loading`، فنفذت النقرة الثانية وبدأت عملية دفع ثانية بالتوازي!

```jsx
function PayButton({ cartId, amount }) {
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    if (loading) return;
    await api.get(`/carts/${cartId}/check`); // ~300ms: الزر لا يزال مفصلاً ونشطاً خلال هذا الانتظار!
    setLoading(true);              // متأخر جداً: النقرة الثانية بدأت بالفعل عملية دفع ثانية
    await api.post('/payments', { cartId, amount }, { retry: 2 }); // تكرار المحاولة ينشئ عمليات خصم إضافية
    setLoading(false);
    router.push('/confirmation');
  }

  return <button onClick={handlePay} disabled={loading}>Pay {amount} EUR</button>;
}
```

## How to fix it
**على جانب العميل:**
```jsx
function PayButton({ cartId, amount }) {
  const [status, setStatus] = useState('idle'); // idle | processing | error
  const inFlight = useRef(false);
  // مفتاح واحد لكل محاولة دفع؛ يُعاد استخدامه مع إعادة المحاولة، ويُجدد فقط عند محاولة دفع جديدة كلياً
  const idempotencyKey = useRef(crypto.randomUUID());

  async function handlePay() {
    if (inFlight.current) return;   // صمام أمان متزامن، يُفعل قبل أي await
    inFlight.current = true;
    setStatus('processing');
    try {
      await api.post('/payments', { cartId, amount }, {
        headers: { 'Idempotency-Key': idempotencyKey.current },
        retry: 2,                    // إعادة المحاولة آمنة الآن لأنها تحمل نفس المفتاح
      });
      router.push('/confirmation');
    } catch (err) {
      setStatus('error');
      inFlight.current = false;      // السماح بإعادة المحاولة بنفس المفتاح في حال الخطأ
    }
  }

  return (
    <button onClick={handlePay} disabled={status === 'processing'} aria-busy={status === 'processing'}>
      {status === 'processing' ? 'جارٍ معالجة الدفع...' : `دفع ${amount} يورو`}
    </button>
  );
}
```

**على جانب الخادم:**
```js
app.post('/payments', async (req, res) => {
  const key = req.get('Idempotency-Key');
  if (!key) return res.status(400).json({ error: 'مطلوب توفير Idempotency-Key' });

  // إدراج ذري: قيد الفرادة على (user_id, key) يجعل الطلبات المكررة المتزامنة تفشل هنا فوراً
  const inserted = await db.idempotency.insertIfAbsent({
    userId: req.user.id, key, requestHash: hash(req.body), status: 'processing',
  });

  if (!inserted) {
    const existing = await db.idempotency.find(req.user.id, key);
    if (existing.requestHash !== hash(req.body)) return res.status(422).json({ error: 'إعادة استخدام نفس المفتاح مع بيانات مختلفة' });
    if (existing.status === 'processing') return res.status(409).json({ error: 'عملية الدفع قيد التنفيذ حالياً' });
    return res.status(existing.httpStatus).json(existing.response); // إعادة نفس النتيجة الأصلية المحفوظة
  }

  const charge = await psp.charge(req.body.cartId, req.body.amount, { idempotencyKey: key });
  const response = { status: 'paid', chargeId: charge.id };
  await db.idempotency.complete(req.user.id, key, { httpStatus: 200, response });
  res.json(response);
});
```
سبب نجاح الحل: يمنع كائن الـ ref المتزامن النقرة الثانية في نفس اللحظة وقبل أي إعادة تصيير. وعلى الخادم، يضمن قيد الفرادة (Unique Constraint) معالجة طلب واحد فقط لكل مفتاح: فأي طلب مكرر يستلم النتيجة الأصلية المخزنة دون تكرار الخصم.

## How to say it in the interview
- "تعطيل الزر في الواجهة هو لتحسين تجربة المستخدم فقط وليس لضمان الدقة والأمان. أنا أضع صمام أمان متزامن بـ `useRef` في العميل، مع فرض مفتاح حيادية العملية (Idempotency Key) بقيد فريد في قاعدة بيانات الخادم."
- "يُنشأ المفتاح مرة واحدة لكل محاولة شراء ويُعاد استخدامه في المحاولات المتكررة؛ فتوليد مفتاح جديد مع كل نقرة يفرغ النمط من فائدته تماماً."
- سؤال متابعة: "لماذا لا نكتفي بفحص `if (loading)` فقط؟" لأن `setState` غير متزامنة، ونقرتان متتاليتان في نفس اللحظة تمران معاً بنجاح قبل أن يُعاد تصيير المكون. أما `useRef` فتتحدث تزامناً وفي الحال.
- الموازنة (Trade-off): يتطلب تخزين المفاتيح وقتاً محدداً للانتهاء (TTL كـ 24 ساعة) والتعامل مع حالة "الطلب قيد المعالجة" (إرجاع رمز 409)، لكن هذا أقل كلفة بكثير من تسوية النزاعات البنكية وإعادة الأموال للعملاء.
