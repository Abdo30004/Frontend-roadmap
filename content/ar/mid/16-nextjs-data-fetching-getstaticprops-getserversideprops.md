# كيف تجلب البيانات في Next.js باستخدام getStaticProps و getServerSideProps (وما بديلهما في الـ App Router)؟

**Level:** Mid
**Merged from (original phrasings):**
- كيف تجلب البيانات في Next.js باستخدام getStaticProps و getServerSideProps؟

## The concept
- **في نمط Pages Router (`pages/`)**: يتم جلب البيانات عبر دوال مخصصة تُصدّر من ملف الصفحة. تُنفذ هذه الدوال على الخادم فقط ولا تدخل أبداً في حزمة الجافاسكريبت المشحونة للعميل:
  - `getStaticProps`: تُنفذ في **وقت البناء (Build time)** وتنتج كود HTML ثابتاً وملف JSON يمكن لشبكات CDN تخزينهما مؤقتاً. وعند إضافة `revalidate: N` يتحول المسار إلى **ISR (Incremental Static Regeneration)**، والذي يعيد بناء الصفحة في الخلفية كل N ثانية كحد أقصى. وللمسارات الديناميكية تقترن بـ `getStaticPaths` مع `fallback: 'blocking'` لتوليد الصفحات التي لم تبنَ مسبقاً.
  - `getServerSideProps`: تُنفذ **مع كل طلب وارد** وتمتلك وصولاً مباشراً لكائنات `req` و `res` والكوكيز والـ query parameters. وتُستخدم للبيانات الخاصة بكل مستخدم أو البيانات الحية التي لا تقبل التأخير. وهي أبطأ وتستهلك معالج الخادم مع كل زيارة.
  - كلتا الدالتين تُرجعان `{ props }`، أو `{ notFound: true }`، أو `{ redirect }`. ويجب أن تكون الـ props قابلة للتحويل إلى JSON (لا تقبل كائنات `Date` أو `undefined`).
- **في نمط App Router (`app/`)**: تم الاستغناء عن تلك الدوال الخاصة؛ فمكونات الخادم (Server Components) أصبحت غير متزامنة (`async`) وتستدعي `fetch` أو قاعدة البيانات مباشرة. ويتم ضبط التخزين المؤقت لكل طلب أو لكل مسار:
  - `fetch(url, { cache: 'force-cache' })` يكافئ `getStaticProps`.
  - `fetch(url, { next: { revalidate: 60 } })` أو `export const revalidate = 60` يكافئ `ISR`.
  - `fetch(url, { cache: 'no-store' })` أو استخدام `cookies()` / `headers()` أو `export const dynamic = 'force-dynamic'` يكافئ `getServerSideProps`.
  - تحل دالة `generateStaticParams` محل `getStaticPaths`. وتتكفل `revalidateTag` و `revalidatePath` بإعادة الصلاحية الفورية عند الطلب.
- تنبيه: بدءاً من Next.js 15، أصبحت طلبات `fetch` **غير مخزنة مؤقتاً افتراضياً (uncached by default)**، وعليك تفعيل التخزين المؤقت صراحة عند الحاجة.

## Real-life example
متجر إلكتروني للأجهزة بنى صفحة تفاصيل المنتج باستخدام `getServerSideProps`. خلال حملة عروض الجمعة البيضاء، كانت كل زيارة لصفحة المنتج تضرب الخادم الأصلي وخادم قاعدة البيانات مباشرة، فقفز مؤشر TTFB من 150 مللي ثانية إلى 3 ثوانٍ كاملة وبدأ الخادم ينهار ويعيد خطأ 503. في الواقع، بيانات المنتج (العنوان والمواصفات والصور) تتغير بضع مرات في اليوم فقط، وعدد القطع المتبقية في المخزون هو الشيء الوحيد المتغير لحظياً. وفي المقابل، بُنيت صفحة "طلباتي" باستخدام `getStaticProps`، مما جعل جميع المستخدمين يشاهدون نفس قائمة الطلبات الثابتة الخاصة بأول مستخدم بعد عملية النشر، وهو خرق فادح لخصوصية البيانات!

```jsx
// pages/products/[slug].jsx: تصيير كامل على الخادم مع كل زيارة لبيانات شبه ثابتة
export async function getServerSideProps({ params }) {
  const product = await fetch(`${API}/products/${params.slug}`).then(r => r.json());
  return { props: { product } };
}

// pages/account/orders.jsx: صفحة ثابتة لبيانات شخصية تختلف لكل مستخدم (خطأ كارثي!)
export async function getStaticProps() {
  const orders = await fetch(`${API}/orders`, {
    headers: { Authorization: `Bearer ${process.env.SERVICE_TOKEN}` },
  }).then(r => r.json());
  return { props: { orders } }; // يتم تجميدها في الـ HTML وقت البناء وتظهر موحدة للجميع!
}
```

## How to fix it
**حل Pages Router:**
```jsx
// pages/products/[slug].jsx: استخدام ISR من الـ CDN مع تحديث كل 5 دقائق
export async function getStaticPaths() {
  const top = await fetch(`${API}/products?top=200`).then(r => r.json());
  return { paths: top.map(p => ({ params: { slug: p.slug } })), fallback: 'blocking' };
}

export async function getStaticProps({ params }) {
  const res = await fetch(`${API}/products/${params.slug}`);
  if (res.status === 404) return { notFound: true, revalidate: 60 };
  const product = await res.json();
  return { props: { product }, revalidate: 300 };
}
// كمية المخزون اللحظية تُجلب من جانب العميل عبر (SWR / React Query) داخل الصفحة

// pages/account/orders.jsx: لكل طلب ولكل مستخدم على حدة
export async function getServerSideProps({ req }) {
  const session = req.cookies.session;
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  const orders = await fetch(`${API}/me/orders`, {
    headers: { Cookie: `session=${session}` },
  }).then(r => r.json());
  return { props: { orders } };
}
```

**المكافئ في App Router الحديث:**
```jsx
// app/products/[slug]/page.jsx
export const revalidate = 300;                     // نمط ISR للمسار

export async function generateStaticParams() {
  const top = await fetch(`${API}/products?top=200`).then(r => r.json());
  return top.map(p => ({ slug: p.slug }));
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = await fetch(`${API}/products/${slug}`, {
    next: { revalidate: 300, tags: [`product:${slug}`] },
  }).then(r => r.json());
  return <ProductView product={product} />;      // المخزون: مكون عميل يستعلم دورياً من /api/stock
}

// app/account/orders/page.jsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function OrdersPage() {
  const session = (await cookies()).get('session')?.value; // يجعل المسار ديناميكياً
  if (!session) redirect('/login');
  const orders = await fetch(`${API}/me/orders`, {
    headers: { Cookie: `session=${session}` },
    cache: 'no-store',
  }).then(r => r.json());
  return <OrdersList orders={orders} />;
}
```

عندما يقوم نظام إدارة المحتوى (CMS) بتحديث بيانات المنتج، يستدعي مسار webhook دالة `revalidateTag('product:' + slug)` لتحديث كاش الصفحة فوراً دون انتظار مرور الـ 5 دقائق.

سبب نجاح الحل: تُخدم البيانات المشتركة بطيئة التغير مباشرة من شبكات CDN فائقة السرعة، فلا يتحمل الخادم سوى عملية إعادة بناء واحدة لكل منتج كل 5 دقائق بدلاً من المعالجة مع كل نقرة. وتُصيّر البيانات الخاصة بكل مستخدم في وقتها مع التحقق الصارم من جلسته.

## How to say it in the interview
- "المعيار الذي أستند عليه هو: هل هذه البيانات متطابقة لكل المستخدمين، وما مدى حداثتها المطلوبة؟ إن كانت متطابقة وتتحمل التأخير أستخدم التوليد الثابت (Static) أو ISR؛ وإن كانت مخصصة لمستخدم أو تتطلب بيانات لحظية فورية أستخدم SSR أو `no-store`."
- "في الـ App Router ينتقل هذا القرار مباشرة لخيارات دالة `fetch` وإعدادات شريحة المسار: `force-cache`، و `revalidate`، و `no-store`، و `dynamic`."
- فخ شائع: استدعاء مسار الـ API الداخلي الخاص بك (`/api/...`) من داخل `getServerSideProps`. هذا يضيف قفزة شبكة غير ضرورية (Extra network hop)؛ بل استدعِ طبقة البيانات أو الدالة المشتركة مباشرة.
- الموازنة (Trade-off): قد يقدم ISR بيانات قديمة لطلب واحد بعد انقضاء نافذة الوقت (وفق مبدأ stale-while-revalidate). لذا استخدم إعادة التوليد الفوري عند الطلب (On-demand revalidation عبر tags) متى ما كانت دقة البيانات حيوية.
