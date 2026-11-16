# What is Next.js and what are its advantages over plain React?

**Level:** Junior
**Merged from (original phrasings):**
- What is Next.js?
- What are the advantages of Next.js over React.js?

## The concept (short answer)
- **React** is a UI library: it renders components. It does not decide routing, data fetching, rendering strategy, bundling or deployment. A plain React app (Vite, old Create React App) is usually a **client-side rendered SPA**: the server sends an almost empty HTML file plus a JS bundle, and the browser builds the page.
- **Next.js** is a **React framework** (by Vercel) that adds those missing pieces:
  - **File-based routing** (App Router: `app/products/[id]/page.tsx`), layouts, loading and error boundaries per route.
  - **Multiple rendering strategies** per route: SSR (render on each request), SSG (render at build), ISR (static, revalidated every N seconds), and CSR where needed.
  - **React Server Components** by default: components run on the server, can fetch data or query a DB directly, and send zero JS for themselves to the browser.
  - **Built-in optimizations**: `next/image` (resizing, lazy loading, modern formats), `next/font`, automatic code splitting per route, prefetching `<Link>`.
  - **Backend in the same project**: Route Handlers (`app/api/.../route.ts`), Server Actions, Middleware.
- Main advantages: better **SEO** and social previews (real HTML on first response), faster **First Contentful Paint / LCP**, less client JS, and less setup.
- Costs: you need a Node server (or serverless/edge) for SSR, more concepts to learn (server vs client components, caching), and some coupling to the framework's conventions.

## Real-life example: the problem
A typical case: an online furniture store was built as a client-side React SPA. Marketing complained that product pages did not show up properly in Google results and that links shared on social media showed a blank preview with the title "React App". On mid-range phones the product page showed a white screen with a spinner for about 3 seconds, because the browser had to download a 900 KB bundle, run it, then fetch the product, then render.

```jsx
// src/pages/ProductPage.jsx (React SPA with react-router)
export default function ProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    fetch(`https://api.store.com/products/${id}`)
      .then((r) => r.json())
      .then(setProduct);
  }, [id]);

  if (!product) return <Spinner />;           // this is what crawlers and users see first
  document.title = product.name;              // too late for social previews
  return (
    <main>
      <h1>{product.name}</h1>
      <img src={product.imageUrl} />          {/* 2 MB original image */}
      <p>{product.description}</p>
    </main>
  );
}
```

```html
<!-- What the server actually sends -->
<html><head><title>React App</title></head>
<body><div id="root"></div><script src="/bundle.js"></script></body></html>
```

## How to fix it
Move the page to the Next.js App Router as a Server Component with ISR and metadata.

```tsx
// app/products/[id]/page.tsx  (Server Component by default, Next.js 15)
import Image from "next/image";
import { notFound } from "next/navigation";
import AddToCartButton from "./AddToCartButton";

export const revalidate = 300; // ISR: regenerate at most every 5 minutes

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
  const product = await getProduct(id);          // fetch is de-duplicated
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
      <AddToCartButton productId={product.id} />   {/* only this ships JS */}
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
    <button onClick={() => { /* call cart API */ setAdded(true); }}>
      {added ? "Added" : "Add to cart"}
    </button>
  );
}
```

```tsx
// app/products/[id]/loading.tsx: shown instantly while the page streams
export default function Loading() { return <p>Loading product...</p>; }
```

Why it works:
- The HTML response already contains the product name, description, image and `<meta>`/Open Graph tags, so crawlers and social networks see real content.
- ISR serves a cached static page from the CDN and refreshes it in the background, so it is fast like a static site but still updates.
- Only the interactive button is a Client Component; the rest sends no component JS, shrinking the bundle.
- `next/image` serves a resized WebP/AVIF instead of a 2 MB original.

Alternatives: Remix / React Router v7 framework mode, or Astro for content-heavy sites; for a logged-in internal dashboard where SEO does not matter, a Vite SPA is still a perfectly good choice.

## How to say it in the interview
- "React is a UI library; Next.js is a full React framework that adds routing, server rendering, Server Components, data fetching, image/font optimization and API routes."
- Key advantages: SEO and social previews, faster first load because HTML comes from the server, less JS thanks to Server Components, and per-route choice of SSR/SSG/ISR.
- Follow-up: "Server vs Client Components?" Server Components can't use state, effects or browser APIs; add `"use client"` only for interactive leaves.
- Trade-off: more complexity (caching rules, server infrastructure) than a static SPA; not worth it for a purely internal tool behind a login.
