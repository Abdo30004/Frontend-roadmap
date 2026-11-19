# أعلام الميزات (Feature Flags) واختبارات A/B في تطبيقات React الضخمة

**Level:** Senior
**Merged from (original phrasings):**
- ما هو أسلوبك في تنفيذ أعلام الميزات (Feature Flags) في تطبيقات الواجهة الأمامية الضخمة؟
- اشرح استراتيجيتك لاختبارات A/B في تطبيقات React.‏

## The concept (short answer)

- **علم الميزة (Feature Flag):** يفصل عملية النشر البرمجي (Deploy) عن إطلاق الميزة للمستخدمين (Release): حيث يُشحن الكود في حالة خاملة (Dark) ويتم تفعيله بحسب المستخدم، أو الشريحة (Segment)، أو كنسبة مئوية تدريجية، مع وجود قاطع طوارئ فوري (Kill Switch). أما **اختبار A/B** فهو علم ميزة بعدة نسخ ومسارات (variants) مقترن بمقياس أداء محدد وتحليل إحصائي صارم.
- استخدم **مزود خدمة متخصص** (مثل LaunchDarkly أو Unleash أو GrowthBook أو Statsig أو Flagsmith أو خدمة داخلية) من وراء مغلف برمجي خفيف خاص بك (`useFlag('new-checkout')`)، لتمكين استبدال المزود بسهولة وضمان دقة الأنواع (Type-safe flags).‏
- **مشكلة الوميض البصري (Flicker):** إذا جُلبت قيم الأعلام من المتصفح بعد الرسم الأول، يرى المستخدم النسخة الأصلية ثم تقفز النسخة الجديدة فجأة. والحل هو **التقييم على الخادم** (عبر Server Components أو Middleware أو على أطراف الشبكة Edge) أو حقن قيم الأعلام أولياً في كود الـ HTML، وحجب التصيير حتى تكتمل معرفة القيم.
- **التوزيع الثابت (Sticky Assignment):** توزيع المستخدمين بالاعتماد على معرّف ثابت (معرف المستخدم User ID، أو كوكي مجهول منشأ عند الـ Edge) باستخدام خوارزمية تجزئة محددة حتمية (Deterministic Hashing)، حتى يرى نفس المستخدم نفس النسخة دائماً عبر التحديثات ومختلف الأجهزة.
- **القياس الدقيق:** تسجيل حدث التعرض (`$exposure`) فقط عندما يتم تصيير النسخة أمام المستخدم فعلياً، وتحديد المقياس الأساسي والمقاييس الوقائية مسبقاً، والتشغيل حتى بلوغ حجم العينة الإحصائية المحسوب، وتجنب استراق النظر للنتائج وإيقاف الاختبار مبكراً.
- **الأعلام ديون تقنية:** يحصل كل علم على مالك وتاريخ انتهاء صلاحية؛ وتُحذف الأعلام المتقادمة دورياً (عبر قواعد فحص lint، وتقارير أسبوعية بالأعلام المستقرة عند 100% لأكثر من 30 يوماً).‏

## Real-life example: the problem

اختبار A/B لصفحة إتمام الشراء في متجر: "صفحة شراء من خطوة واحدة" مقابل "الشراء التقليدي من ثلاث خطوات". بدت النتائج مبهرة لصالح النسخة الجديدة، لكن تذاكر الدعم بدأت بالشكوى: "الصفحة تقفز وتتغير أشكال الحقول أثناء كتابتي للمعلومات!". اكتشف الفريق: (1) يرى المستخدمون الصفحة القديمة لـ ~400ms ثم تتبدل بالجديدة، وأحياناً بعد أن يبدأ المستخدم بالكتابة؛ (2) اعتمد التوزيع على `Math.random()` عند كل تحميل للصفحة، فتنقل نفس المستخدم بين النسختين واحتُسب في المجموعتين معاً؛ (3) احتُسبت عمليات الشراء لكل من حمّل الحزمة وليس لمن رأى النسخة بالفعل! وبعد عام، كان الكود لا يزال مليئاً بـ 140 علماً برمجياً بتفرعات `if` متداخلة يخشى الجميع لمسها.

```tsx
// CheckoutPage.tsx - BROKEN
'use client';
export default function CheckoutPage() {
  const [variant, setVariant] = useState<'control' | 'onepage'>('control');

  useEffect(() => {
    // fetched after first paint -> flicker; random each load -> no stickiness
    fetch('/api/flags').then(() => {
      setVariant(Math.random() < 0.5 ? 'onepage' : 'control');
    });
    analytics.track('checkout_viewed');          // no variant, no exposure event
  }, []);

  return variant === 'onepage' ? <OnePageCheckout /> : <ThreeStepCheckout />;
}
```

## How to fix it

```ts
// middleware.ts - give every visitor a stable anonymous ID before render
import { NextResponse, type NextRequest } from 'next/server';
export function middleware(req: NextRequest) {
  if (req.cookies.get('anon_id')) return NextResponse.next();
  const id = crypto.randomUUID();
  req.cookies.set('anon_id', id);                     // visible to Server Components on THIS request
  const res = NextResponse.next({ request: { headers: req.headers } });
  res.cookies.set('anon_id', id, { maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: 'lax' });
  return res;
}
```

```ts
// lib/flags.ts - typed wrapper around the provider, evaluated on the server
import { cookies } from 'next/headers';
import { flagClient } from './flag-provider';        // e.g. GrowthBook/LaunchDarkly server SDK

export type Flags = { 'checkout-onepage': 'control' | 'onepage' };

export async function getVariant<K extends keyof Flags>(key: K, userId?: string): Promise<Flags[K]> {
  const anonId = (await cookies()).get('anon_id')?.value;
  // provider hashes (flagKey + stable id) -> same bucket on every request
  return flagClient.variation(key, { key: userId ?? anonId ?? 'anonymous' }, 'control');
}
```

```tsx
// app/checkout/page.tsx - Server Component: correct variant in the first HTML
import { getVariant } from '@/lib/flags';
import { ExposureLogger } from './ExposureLogger';

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  const variant = await getVariant('checkout-onepage', user?.id);
  return (
    <>
      <ExposureLogger experiment="checkout-onepage" variant={variant} />
      {variant === 'onepage' ? <OnePageCheckout /> : <ThreeStepCheckout />}
    </>
  );
}
```

```tsx
// ExposureLogger.tsx - log exposure only when actually rendered
'use client';
export function ExposureLogger({ experiment, variant }: { experiment: string; variant: string }) {
  useEffect(() => {
    analytics.track('$exposure', { experiment, variant });   // purchases joined on anon/user id
  }, [experiment, variant]);
  return null;
}
```

```ts
// flags.registry.ts - every flag has an owner and an expiry
export const FLAG_REGISTRY = {
  'checkout-onepage': { owner: 'team-checkout', type: 'experiment', expires: '2027-01-31' },
} as const;
// CI script fails when a flag is past `expires`, or when a key used in code
// is missing from the registry; a weekly report lists flags at 100% for 30+ days.
```

لماذا ينجح هذا الحل: يحدد الخادم النسخة المستهدفة قبل إرسال كود الـ HTML، مما يقضي على الوميض وانزياح التخطيط تماماً؛ وتجزئة المعرف الثابت تضمن توزيعاً عادلاً وثابتاً لنفس المستخدم؛ وتضمن أحداث التعرض `$exposure` احتساب من شاهد النسخة فقط في التحليلات؛ ويحول سجل الأعلام مع فحوصات الـ CI تنظيف الأكواد إلى مهمة روتينية مستمرة بدلاً من تنقيب أثري في المستقبل.

البدائل: في تطبيقات SPA البحتة، قم بحقن الأعلام في وسم `<script>` أولي في كود الـ HTML، أو احجب التصيير خلف هيكل تحميل مؤقت مع مهلة سقوط بديل (timeout fallback). وتوفر عمليات إعادة التوجيه عند الـ Edge حلاً ممتازاً لتفادي الوميض مع الحفاظ على كاش الصفحات لكل نسخة.

## How to say it in the interview

- "تفصل الأعلام النشر عن الإطلاق؛ أقوم بتغليف مزود الأعلام في خطافات نمطية واضحة، وتقييمها على الخادم لتفادي الوميض، والتوزيع عبر تجزئة معرف ثابت لضمان ثبات التجربة."
- "في التجارب: تحديد المقاييس الأساسية والوقائية مسبقاً، وتسجيل أحداث التعرض عند التصيير الفعلي، وحساب حجم العينة المستهدفة، وتجنب إيقاف الاختبار مبكراً."
- فخ المقابلة: "ماذا عن التخزين المؤقت (Caching)؟" - تقييم الأعلام على الخادم يعطل كاش الـ CDN المشترك؛ لذا اجعل الكاش يتغير (Vary) بحسب كوكي النسخة أو أعد كتابة المسار إلى روابط مخصصة لكل نسخة.
- المفاضلة (Trade-off): تُضيف الأعلام تفرعات برمجية وتعقيدات في الاختبار. حافظ على عمرها القصير، وعيّن مالكاً وتاريخ انتهاء لكل علم، واحذف المسار الخاسر فور صدور القرار النهائي.
