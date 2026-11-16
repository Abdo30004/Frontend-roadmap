# Where a Server Component Ends and a Client Component Begins

**Level:** Senior
**Merged from (original phrasings):**
- How do you decide where a Server Component ends and a Client Component begins?

## The concept (short answer)

- **Default to Server Components.** They run only on the server (or at build time), can be `async`, read the database/secrets directly, and send **zero JS** for themselves to the browser - only their rendered output (the RSC payload).
- **A Client Component is needed only for interactivity or browser APIs:** `useState`/`useEffect`/event handlers, `window`/`localStorage`, browser-only libraries, context providers.
- **`"use client"` marks a module boundary, not a single component:** that file *and everything it imports* goes into the client bundle. So **push `"use client"` down to the leaves** (the button, the toggle, the chart), not the page or layout.
- **Composition across the boundary:** a Client Component cannot `import` a Server Component, but it can receive one as `children` or another prop. The server renders it and the client just places the result - e.g. a client `<Tabs>` or `<Modal>` wrapping server-rendered content.
- **The boundary is a serialization boundary:** props from server to client must be serializable (strings, numbers, plain objects/arrays, `Date`, `Map`/`Set`, Promises, JSX, Server Actions). No regular functions or class instances. And **everything you pass is visible in the page source** - props are embedded in the HTML/RSC payload.
- **Guardrails:** `import 'server-only'` in data/secret modules makes the build fail if a client file imports them; pass DTOs (only the fields the UI needs), never raw DB rows.

## Real-life example: the problem

An online marketplace's product page in Next.js App Router. A developer needed an "Add to cart" button with state, got the error "useState only works in Client Components", and put `"use client"` at the top of the page. Result: the route's JS jumped by ~350 KB because the markdown renderer and syntax highlighter used for the description now ship to the browser, and mobile INP regressed. Worse, a security review found the seller's email, payout IBAN and internal margin in the page source: the whole DB row was passed as a prop to a client component.

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

Server page, client leaf, DTOs, and a hard guard on server-only modules.

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

Why it works: only `AddToCart` and `Tabs` ship as JS; the markdown library and the data access stay on the server. Tabs are interactive yet their content is server-rendered because it arrives as `children`. The DTO guarantees only public fields cross the serialization boundary, and `server-only` turns an accidental client import of the data layer into a build error instead of a leak. (Sanitize the markdown HTML too, e.g. with DOMPurify on the server, if sellers write it.) React's experimental taint APIs can add another guard for objects that must never reach the client.

## How to say it in the interview

- "Server by default; `use client` only on the smallest interactive leaf, because it pulls the whole import graph into the bundle. Client wrappers receive server content as children."
- "The server-client boundary is a serialization boundary - every prop ends up in the page source, so I pass DTOs and guard data modules with `server-only`."
- Trap: env vars without `NEXT_PUBLIC_` are not inlined into client bundles, but data *read* with them and passed as props is - leaks happen through props, not imports. Follow-up: context providers are client components, so wrap `{children}` in them at the layout without converting the layout.
- Trade-off: more server rendering means less JS but more server load and a round trip for every interaction that needs fresh server UI; highly interactive widgets (editors, maps) belong on the client.
