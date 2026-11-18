# ما هو Next.js وما هي مزاياه مقارنة بـ React التقليدي؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- ما هو Next.js؟
- ما هي مزايا Next.js مقارنة بـ React.js؟

## The concept (short answer)
- **React** هي مكتبة لبناء واجهات المستخدم: دورها ينحصر في تصيير المكونات. ولا تتدخل في التوجيه (routing)، أو جلب البيانات (data fetching)، أو استراتيجيات التصيير، أو حزم الملفات (bundling)، أو النشر. وتطبيق React البسيط (المبني بـ Vite أو Create React App القديم) هو عادةً **تطبيق صفحة واحدة مصيّر في جانب العميل (CSR)**: يرسل الخادم ملف HTML شبه فارغ مع حزمة جافاسكريبت ضخمة، ويتولى المتصفح بناء الصفحة من الصفر.
- **Next.js** هو **إطار عمل متكامل مبني على React** (من تطوير شركة Vercel) يوفر كافة الأجزاء المفقودة:
  - **توجيه قائم على بنية الملفات (File-based routing)** في App Router (`app/products/[id]/page.tsx`)، مع تخطيطات مشتركة وشاشات تحميل وحدود أخطاء مدمجة لكل مسار.
  - **استراتيجيات تصيير متعددة** لكل مسار: التصيير في جانب الخادم (SSR لكل طلب)، والتوليد الساكن (SSG وقت البناء)، وإعادة التوليد الساكن التدريجي (ISR لتحديث الصفحة في الخلفية كل N ثوانٍ)، والتصيير في جانب العميل (CSR) عند الحاجة.
  - **مكونات الخادم في React (React Server Components / RSC)** افتراضياً: تُنفذ على الخادم، وتجلب البيانات أو تستعلم من قاعدة البيانات مباشرة، وترسل كود HTML خالياً من الجافاسكريبت إلى المتصفح.
  - **تحسينات مدمجة تلقائية للأداء**: مكون `next/image` (تغيير الأبعاد والتحميل الكسول والتحويل لصيغ WebP/AVIF)، ومكون `next/font`، وتقسيم الكود تلقائياً لكل مسار، وجلب المسارات مسبقاً عبر `<Link>`.‏
  - **واجهة خلفية مدمجة**: مسارات الـ API عبر Route Handlers (`app/api/.../route.ts`)، و Server Actions، والبرمجيات الوسيطة (Middleware).‏
- المزايا الرئيسية: تحسين هائل في **تهيئة محركات البحث (SEO)** ومعاينات شبكات التواصل الاجتماعي، وتسريع كبير في **أول رسم للمحتوى (FCP / LCP)**، وتقليل حجم الجافاسكريبت المرسلة للعميل.
- التكاليف: تتطلب خادم Node.js (أو بيئة Serverless/Edge) للتصيير الخادمي، ومفاهيم جديدة للإتقان (مكونات الخادم مقابل مكونات العميل، استراتيجيات التخزين المؤقت)، والالتزام باتفاقيات إطار العمل.

## Real-life example: the problem
حالة شائعة: تم بناء متجر إلكتروني لبيع الأثاث كتطبيق React SPA في جانب العميل. اشتكى فريق التسويق من أن صفحات المنتجات لا تظهر بشكل صحيح في نتائج بحث Google، وأن الروابط المشاركة على وسائل التواصل الاجتماعي تعرض معاينة فارغة بعنوان "React App". وعلى الهواتف المتوسطة، كانت صفحة المنتج تعرض شاشة بيضاء بمؤشر تحميل لمدة 3 ثوانٍ، لأن المتصفح كان عليه تحميل حزمة بحجم 900 كيلوبايت، وتشغيلها، ثم طلب بيانات المنتج، ثم تصيير الصفحة.

```jsx
// src/pages/ProductPage.jsx (تطبيق React SPA تقليدي)
export default function ProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    fetch(`https://api.store.com/products/${id}`)
      .then((r) => r.json())
      .then(setProduct);
  }, [id]);

  if (!product) return <Spinner />;           // هذا كل ما تراه محركات البحث والمستخدم في البداية!
  document.title = product.name;              // تأتي متأخرة جداً لمعاينات شبكات التواصل
  return (
    <main>
      <h1>{product.name}</h1>
      <img src={product.imageUrl} />          {/* صورة أصلية بحجم 2 ميجابايت */}
      <p>{product.description}</p>
    </main>
  );
}
```

```html
<!-- ما يرسله الخادم فعلياً للعميل ومحركات البحث -->
<html><head><title>React App</title></head>
<body><div id="root"></div><script src="/bundle.js"></script></body></html>
```

## How to fix it
نقل الصفحة إلى App Router في Next.js كمكون خادم (Server Component) مع ميزة ISR والبيانات الوصفية (Metadata).‏

```tsx
// app/products/[id]/page.tsx (مكون خادم افتراضياً في Next.js 15)
import Image from "next/image";
import { notFound } from "next/navigation";
import AddToCartButton from "./AddToCartButton";

export const revalidate = 300; // ISR: إعادة توليد الصفحة كل 5 دقائق كحد أقصى

async function getProduct(id: string) {
  const res = await fetch(`https://api.store.com/products/${id}`, {
    next: { revalidate: 300 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load product");
  return res.json();
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);          // يتم إلغاء تكرار طلب fetch تلقائياً
  return {
    title: product ? `${product.name} | Nordic Home` : "Product not found",
    description: product?.shortDescription,
    openGraph: { images: product ? [product.imageUrl] : [] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  return (
    <main>
      <h1>{product.name}</h1>
      <Image src={product.imageUrl} alt={product.name} width={800} height={600} priority />
      <p>{product.description}</p>
      <AddToCartButton productId={product.id} />   {/* هذا الزر فقط هو من يرسل كود جافاسكريبت */}
    </main>
  );
}
```

```tsx
// app/products/[id]/AddToCartButton.tsx
"use client";
import { useState } from "react";

export default function AddToCartButton({ productId }: { productId: string }) {
  const [added, setAdded] = useState(false);
  return (
    <button onClick={() => { /* استدعاء API السلة */ setAdded(true); }}>
      {added ? "Added" : "Add to cart"}
    </button>
  );
}
```

```tsx
// app/products/[id]/loading.tsx: تظهر فوراً أثناء تدفق محتوى الصفحة
export default function Loading() { return <p>Loading product...</p>; }
```

لماذا ينجح هذا الحل:
- تحتوي استجابة الـ HTML الأولى القادمة من الخادم على اسم المنتج ووصفه والصورة ووسوم Open Graph كاملة، فتقرأها محركات البحث وشبكات التواصل فوراً.
- تخدم ميزة ISR صفحات ساكنة فائقة السرعة مخزنة على شبكات الـ CDN وتحدثها بهدوء في الخلفية.
- الزر التفاعلي فقط هو المصنف كـ Client Component؛ وباقي الصفحة كود خادم خالص لا يرسل بايت جافاسكريبت واحداً إلى المتصفح.
- يوفر `next/image` صورة محسنة ومضغوطة بصيغة WebP بأبعاد الشاشة بدلاً من الصورة الأصلية ذات الحجم الكبير.

بدائل أخرى: نمط إطار العمل في Remix أو React Router v7، أو Astro للمواقع المعتمدة على المحتوى؛ ولوحة تحكم داخلية مغلقة لا تحتاج إلى SEO، فإن تطبيق Vite SPA بسيط يظل خياراً ممتازاً جداً.

## How to say it in the interview
- "React هي مكتبة واجهات مستخدم؛ بينما Next.js هو إطار عمل شامل يضيف التوجيه، وتصيير الخادم، ومكونات الخادم RSC، وتحسينات الصور والخطوط المدمجة، ومسارات الـ API."
- المزايا الأساسية: تحسين محركات البحث SEO، وسرعة التحميل الأولى بفضل إرسال HTML جاهز، وتقليل استهلاك الجافاسكريبت في المتصفح، وإمكانية الاختيار بين SSR و SSG و ISR لكل مسار.
- سؤال المتابعة: "مكونات الخادم مقابل مكونات العميل؟" لا تستطيع مكونات الخادم استخدام الـ state أو الـ effects أو واجهات المتصفح؛ ونضيف `"use client"` فقط في الأطراف التفاعلية من الشجرة.
- المفاضلة: تزيد تعقيدات البنية التحتية للخوادم وقواعد الكاش مقارنة بتطبيقات الـ SPA البسيطة؛ لذا فهي غير ضرورية للأدوات الإدارية الداخلية المغلقة.
