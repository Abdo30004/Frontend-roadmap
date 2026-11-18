# ما هو نمط الـ Backend for Frontend (BFF)؟

**Level:** Mid
**Merged from (original phrasings):**
- ما هو نمط BFF (Backend for Frontend)؟

## The concept
- نمط الـ **BFF (Backend for Frontend)** هو عبارة عن طبقة خادم خفيفة **يمتلكها ويطورها فريق الواجهة الأمامية (Frontend team)** ومخصصة لخدمة **عميل واحد محدد** (تطبيق ويب، أو تطبيق جوال، أو شاشة ذكية). وتقع هذه الطبقة كحلقة وصل وسيطة بين واجهة المستخدم وخدمات الخادم الخلفية العامة أو الخدمات المصغرة (Microservices).
- تتولى طبقة الـ BFF **تجميع البيانات وتكييف شكلها (Aggregates and shapes)**: طلب شبكة واحد فقط من المتصفح بدلاً من 5 إلى 10 طلبات لخدمات مختلفة. وتُرجع الحقول التي تحتاجها الشاشة تحديداً، مما يقلص حجم البيانات (Payloads) ويمنع الجلب الفائض (Over-fetching) وشلالات الطلبات المتتالية (Waterfalls).
- تشكل طبقة الـ BFF **حاجزاً أمنياً منيعاً (Security boundary)**: تظل المفاتيح السرية (API keys)، ورموز مصادقة الخدمات، وتكاملات الطرف الثالث داخل الخادم. ولا يستلم المتصفح سوى كوكيز جلسة مشفرة (`httpOnly`)، ويقوم الـ BFF باستبدالها برموز الوصول (Token Handler Pattern).
- **فصل واعتمادية مستقلة (Decoupling)**: تعزل الواجهة الأمامية عن تقلبات الـ Backend؛ فعندما تعدل إحدى الخدمات اسم حقل أو تنقسم لخدمتين، يُعدل كود التوافق داخل الـ BFF فقط دون المساس بكود المتصفح.
- التطبيقات الشائعة: مسارات Next.js Route Handlers، أو Server Components و Server Actions، أو خدمة Node/Fastify مخصصة، أو بوابة GraphQL Gateway.
- قاعدة أساسية: يجب ألا يحتوي الـ BFF على منطق الأعمال الجوهري (Core business logic كقواعد التسعير وحساب الضرائب)؛ بل يبقى ذلك داخل خدمات المجال الخلفية لضمان عدم تباين القواعد بين الويب وتطبيقات الجوال.

## Real-life example
تحتاج الشاشة الرئيسية لتطبيق توصيل طعام إلى: ملف المستخدم، وعناوينه المحفوظة، والمطاعم المجاورة، والعروض الترويجية النشطة، وحالة الطلب الجاري. كان تطبيق React يستدعي 5 خدمات مصغرة مختلفة مباشرة من المتصفح. وعلى أجهزة الجوال عبر شبكة 4G، كانت الصفحة الرئيسية تستغرق 4 ثوانٍ للتحميل: طلب المطاعم ينتظر اكتمال طلب العناوين أولاً (شلال انتظار بطيء)، واستجابة المطاعم تُرجع قوائم الطعام الكاملة (بحجم 900KB) بينما لا تحتاج الشاشة سوى الاسم والتقييم ووقت التوصيل، بالإضافة إلى تسريب المفتاح السري لشريك العروض الترويجية داخل كود الجافاسكريبت المشحون للعميل!

```jsx
// HomeScreen.jsx: المتصفح ينسق استدعاء 5 خدمات مصغرة مباشرة
useEffect(() => {
  (async () => {
    const user = await fetch('https://users.api.example.com/me', { credentials: 'include' }).then(r => r.json());
    const addresses = await fetch(`https://users.api.example.com/${user.id}/addresses`).then(r => r.json());
    const restaurants = await fetch(
      `https://catalog.api.example.com/restaurants?lat=${addresses[0].lat}&lng=${addresses[0].lng}`
    ).then(r => r.json());                                   // 900KB وقوائم كاملة غير مطلوبة
    const promos = await fetch('https://partner-promos.example.com/v2/offers', {
      headers: { 'X-Api-Key': import.meta.env.VITE_PROMO_KEY }, // مفتاح سري مسرب داخل الحزمة!
    }).then(r => r.json());
    const order = await fetch(`https://orders.api.example.com/active?user=${user.id}`).then(r => r.json());
    setState({ user, restaurants, promos, order });
  })();
}, []);
```

المشكلات: رحلات شبكة تسلسلية متعددة من جهاز بطيء، واستجابات متضخمة بالحقول الفائضة، ومفتاح سري مسرب، وإعداد سياسات CORS على 5 خدمات مختلفة، وأي تغيير في الـ Backend يكسر الواجهة.

## How to fix it
أضف نقطة نهاية BFF مخصصة لاحتياجات الشاشة الرئيسية (باستخدام Next.js Route Handler):

```js
// app/api/home/route.js: ينفذ على الخادم، بسرعة فائقة وقريباً من الخدمات الخلفية
import { cookies } from 'next/headers';
import { getAccessToken } from '@/server/auth';

export async function GET() {
  const token = await getAccessToken((await cookies()).get('session')?.value);
  if (!token) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const [user, addresses, order] = await Promise.all([
    fetch(`${USERS_URL}/me`, auth).then(r => r.json()),
    fetch(`${USERS_URL}/me/addresses`, auth).then(r => r.json()),
    fetch(`${ORDERS_URL}/me/active`, auth).then(r => r.json()),
  ]);

  const { lat, lng } = addresses[0] ?? {};
  const [restaurants, promos] = await Promise.allSettled([
    fetch(`${CATALOG_URL}/restaurants?lat=${lat}&lng=${lng}&fields=id,name,rating,eta,imageUrl`).then(r => r.json()),
    fetch(`${PROMOS_URL}/v2/offers`, { headers: { 'X-Api-Key': process.env.PROMO_KEY } }).then(r => r.json()),
  ]);

  return Response.json({
    greetingName: user.firstName,
    activeOrder: order ? { id: order.id, status: order.status, eta: order.eta } : null,
    restaurants: restaurants.status === 'fulfilled' ? restaurants.value.slice(0, 20) : [],
    promos: promos.status === 'fulfilled' ? promos.value.map(p => ({ id: p.id, title: p.title })) : [], // تراجع سلس في حال تعطل العروض
  });
}
```

```jsx
// HomeScreen.jsx: طلب واحد فقط لنفس النطاق
const { data } = useQuery({ queryKey: ['home'], queryFn: () => fetch('/api/home').then(r => r.json()) });
```
سبب نجاح الحل: تجري عمليات تجميع البيانات (Fan-out) بين خوادم داخلية سريعة جداً وبالتوازي التام. ويرسل المتصفح طلباً واحداً إلى نفس النطاق (دون مشاكل CORS وتُرسل الكوكيز تلقائياً) ويستلم بيانات خفيفة ومصممة بدقة للشاشة. والمفتاح السري لا يغادر الخادم إطلاقاً، وفي حال تعطل خدمة العروض تستمر الشاشة بالعمل بسلاسة.

بدائل أخرى: بوابة GraphQL (يحدد العميل الحقول التي يريدها بنفسه وهو نمط ممتاز للشاشات المتعددة المتنوعة)؛ أو بوابات الـ API Gateway العامة التي تتكفل بالتوجيه والأمان ومعدل الطلبات دون تكييف البيانات المخصصة.

## How to say it in the interview
- "الـ BFF هو طبقة خادم مخصصة لكل واجهة مستخدم، يمتلكها فريق الواجهة الأمامية، وتقوم بتجميع الخدمات وتكييف الردود للشاشة وعزل الأسرار ورموز المصادقة بعيداً عن المتصفح."
- "في Next.js يكون الـ BFF مدمجاً بالفعل بشكل طبيعي: مسارات Route Handlers و Server Components و Server Actions تعمل جميعها على الخادم."
- سؤال متابعة / فخ: "ألا يضيف الـ BFF قفزة خادم إضافية؟" بلى، ولكن قفزة واحدة من المتصفح إلى الـ BFF يليها استدعاءات متوازية عبر شبكة الخوادم الداخلية أسرع بكثير من عدة رحلات شبكة تسلسلية وبطيئة من هاتف محمول.
- الموازنة (Trade-off): يضيف الـ BFF خدمة إضافية تتطلب نشراً ومراقبة وتوسيعاً (Scaling)، مع وجود خطر تسرب منطق الأعمال الأساسي إليه وتكراره بين BFF الويب و BFF الجوال.
