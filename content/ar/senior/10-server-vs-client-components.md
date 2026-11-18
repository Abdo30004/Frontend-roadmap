# أين ينتهي الـ Server Component وأين يبدأ الـ Client Component

**Level:** Senior
**Merged from (original phrasings):**
- كيف تقرر أين ينتهي الـ Server Component وأين يبدأ الـ Client Component؟

## The concept (short answer)

- **اجعل Server Components هي الخيار الافتراضي دائماً.** تعمل هذه المكونات على الخادم حصرياً (أو أثناء مرحلة البناء)، ويمكنها أن تكون دوال `async` تقرأ قاعدة البيانات والمفاتيح السرية مباشرة، ولا تُرسل **أي كود JavaScript خاص بها إطلاقاً** إلى المتصفح - بل تكتفي بإرسال ناتج تصييرها فقط (حمولة RSC Payload).
- **لا نحتاج Client Component إلا للتفاعلية أو واجهات المتصفح:** خطافات `useState`/`useEffect` ومعالجات الأحداث (event handlers)، وواجهات المتصفح `window`/`localStorage`، والمكتبات التي تعتمد على المتصفح، ومزودات السياق (context providers).
- **توجيه `"use client"` يُحدد حداً للموديول بأكمله (Module boundary) وليس لمكون مفرد:** فهذا الملف *وكل ما يستورده تحته* سيدخل في حزمة الـ JavaScript الخاصة بالعميل. لذلك **ادفع بتوجيه `"use client"` إلى أقصى أطراف الشجرة (الـ Leaves)** (مثل الزر، أو محدد الكمية، أو الرسم البياني)، ولا تضعه أبداً في قمة الصفحة أو التخطيط (Layout).
- **التركيب عبر الحدود (Composition across the boundary):** لا يستطيع Client Component أن يستورد Server Component مباشرة عبر `import`، ولكنه يستطيع استقباله كخاصية `children` أو أي prop أخرى. يُصيّر الخادم المكون أولاً، ويقتصر دور العميل على وضع النتيجة في موضعها - كأن يكون لديك `<Tabs>` أو `<Modal>` كـ Client Component يُغلف محتوى مصيراً على الخادم.
- **هذا الحد هو حد تسلسلي (Serialization boundary):** يجب أن تكون الـ props الممررة من الخادم إلى العميل قابلة للتسلسل (نصوص، أرقام، كائنات ومصفوفات عادية، `Date`، و `Map`/`Set`، والوعود Promises، وكود JSX، و Server Actions). ولا يمكن تمرير دوال عادية أو كائنات فئات (class instances). وتذكر أن **كل ما تُمرره يظهر بوضوح في سورس الصفحة** - حيث تُدمج الـ props في كود الـ HTML وحمولة الـ RSC.
- **حواجز الأمان:** استخدام `import 'server-only'` في موديولات البيانات والأسرار يجعل البناء يفشل فورياً إذا استوردها ملف عميل بالخطأ؛ ومرّر دائماً كائنات DTO (الحقول التي تحتاجها الواجهة فقط)، وتجنب تمرير صفوف قاعدة البيانات الخام.

## Real-life example: the problem

صفحة منتج في متجر إلكتروني باستخدام Next.js App Router. احتاج المطور إلى زر "Add to cart" بحالة تفاعلية، فظهر له الخطأ "useState only works in Client Components"، فقام بوضع توجيه `"use client"` في أعلى ملف الصفحة بأكمله. النتيجة: قفز حجم حزمة الـ JS لهذا المسار بمقدار ~350 كيلوبايت لأن مكتبة معالجة Markdown ومكتبة تلوين الأكواد (syntax highlighter) المستخدمتين في وصف المنتج أصبحتا تُشحنان لمتصفح العميل، فتدهور مؤشر INP على الهواتف. والأخطر من ذلك: كشفت مراجعة أمنية عن تسرب البريد الإلكتروني للبائع، ورقم الآيبان البنكي، ونسبة الأرباح الداخلية في سورس الصفحة: حيث تم تمرير سجل قاعدة البيانات كاملاً كـ prop إلى مكون عميل!

```tsx
// app/products/[id]/page.tsx
'use client';                                              // whole page + all imports become client JS
import { useEffect, useState } from 'react';
import { marked } from 'marked';                           // heavy, only needed to render HTML once
import hljs from 'highlight.js';

export default function ProductPage({ params }) {
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  useEffect(() => { fetch(`/api/products/${params.id}`).then((r) => r.json()).then(setProduct); }, [params.id]);
  if (!product) return <Spinner />;
  return (
    <>
      <h1>{product.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: marked(product.descriptionMd) }} />
      <input type="number" value={qty} onChange={(e) => setQty(+e.target.value)} />
      <button onClick={() => addToCart(product.id, qty)}>Add to cart</button>
    </>
  );
}

// Elsewhere, the "fixed" server version still leaks:
// <SellerCard seller={await db.seller.findUnique({ where: { id } })} />
// SellerCard is 'use client' -> email, iban, marginPct are serialized into the HTML
```

## How to fix it

صفحة تعمل كـ Server Component، مع جزر تفاعلية صغيرة كـ Client Components، ونقل البيانات عبر DTOs، وحماية صارمة عبر موديولات `server-only`.

```tsx
// lib/products.ts
import 'server-only';                                      // build error if imported from client code
export async function getProductView(id: string) {
  const p = await db.product.findUniqueOrThrow({ where: { id }, include: { seller: true } });
  return {                                                 // DTO: only what the UI needs
    id: p.id,
    title: p.title,
    priceCents: p.priceCents,
    descriptionMd: p.descriptionMd,
    seller: { name: p.seller.displayName, rating: p.seller.rating },
  };
}

// app/products/[id]/page.tsx  (Server Component, no directive)
import { marked } from 'marked';                           // runs on server only, 0 KB to client
import { getProductView } from '@/lib/products';
import { AddToCart } from './AddToCart';
import { SellerCard } from './SellerCard';
import { Tabs } from './Tabs';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductView(id);
  return (
    <>
      <h1>{product.title}</h1>
      <AddToCart productId={product.id} />                {/* small client island */}
      <Tabs labels={['Description', 'Seller']}>
        {/* server-rendered content passed through a client component as children */}
        <div dangerouslySetInnerHTML={{ __html: await marked(product.descriptionMd) }} />
        <SellerCard seller={product.seller} />
      </Tabs>
    </>
  );
}

// app/products/[id]/AddToCart.tsx
'use client';
import { useState, useTransition } from 'react';
import { addToCart } from './actions';                     // Server Action: serializable across the boundary

export function AddToCart({ productId }: { productId: string }) {
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();
  return (
    <>
      <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
      <button disabled={pending} onClick={() => start(() => addToCart(productId, qty))}>Add to cart</button>
    </>
  );
}

// app/products/[id]/Tabs.tsx
'use client';
import { Children, useState, type ReactNode } from 'react';
export function Tabs({ labels, children }: { labels: string[]; children: ReactNode }) {
  const [i, setI] = useState(0);
  return (
    <div>
      {labels.map((l, idx) => <button key={l} aria-pressed={i === idx} onClick={() => setI(idx)}>{l}</button>)}
      {Children.toArray(children)[i]}
    </div>
  );
}
```

لماذا ينجح هذا الحل: يُشحن مكوّنا `AddToCart` و `Tabs` فقط ككود JavaScript إلى العميل؛ بينما تظل مكتبة Markdown الثقيلة وطبقة جلب البيانات محصورة بالكامل على الخادم (0 كيلوبايت على العميل). التبويبات تفاعلية تماماً ومع ذلك فإن محتواها مُصيّر على الخادم لأنه يمر كـ `children`. ويضمن كائن الـ DTO عبور الحقول العامة فقط لحدود التسلسل، كما تُحول حزمة `server-only` أي استيراد خاطئ لبيانات الخادم إلى خطأ يوقف البناء بدلاً من تسريب أمني كارثي.

## How to say it in the interview

- "الخادم هو الأصل؛ ولا أضع توجيه `use client` إلا على أصغر الأوراق التفاعلية (interactive leaves)، لأنه يسحب شجرة الاستيرادات بأكملها إلى حزمة العميل. وتستقبل أغلفة العميل التفاعلية محتوى الخادم عبر خاصية children."
- "الحد الفاصل بين الخادم والعميل هو حد تسلسلي (serialization boundary) - تظهر كل قيمة ممررة في كود الصفحة، لذا أمرر دائماً كائنات DTO نقية وأحمي موديولات البيانات بـ `server-only`."
- فخ المقابلة: المتغيرات البيئية الخالية من بادئة `NEXT_PUBLIC_` لا تُضمن في حزم العميل، لكن البيانات *المقروءة* بواسطتها والممررة كـ props تظهر كاملة في سورس الصفحة - التسريبات تحدث عبر الـ props وليس فقط عبر الاستيرادات. سؤال متابعة: مزودات السياق (context providers) هي مكونات عميل، لذلك غلف `{children}` بداخلها على مستوى الـ layout دون تحويل الـ layout نفسه إلى مكون عميل.
- المفاضلة (Trade-off): زيادة الاعتماد على تصيير الخادم تعني حزم JS أصغر حجماً ولكنها تزيد الحمل على الخوادم وتتطلب رحلة شبكة ذهاباً وإياباً لكل تفاعل يحتاج واجهة خادم جديدة؛ لذلك يجب أن تبقى المكونات فائقة التفاعلية (المحررات، الخرائط) من جانب العميل.
