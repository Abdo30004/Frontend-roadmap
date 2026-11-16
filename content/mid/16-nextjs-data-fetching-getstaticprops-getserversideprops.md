# How do you fetch data in Next.js with getStaticProps and getServerSideProps (and what replaces them in the App Router)?

**Level:** Mid
**Merged from (original phrasings):**
- How do you fetch data in Next.js using getStaticProps and getServerSideProps?

## The concept (short answer)
- **Pages Router (`pages/`):** data fetching is done by functions exported from a page file. They run on the server only and are never included in the client bundle.
  - `getStaticProps`: runs at **build time** and produces static HTML plus JSON that a CDN can cache. Add `revalidate: N` for **ISR**, which regenerates the page in the background at most every N seconds. For dynamic routes it is paired with `getStaticPaths`, using `fallback: 'blocking'` to generate pages that were not pre-built.
  - `getServerSideProps`: runs on **every request** and has access to `req`, `res`, cookies and query. Use it for per-user or must-be-fresh data. It is slower and costs server time on every hit.
  - Both return `{ props }`, `{ notFound: true }` or `{ redirect }`. Props must be JSON-serializable (no `Date`, no `undefined`).
- **App Router (`app/`):** no special functions. Server Components are `async` and call `fetch` or the DB directly. Caching is configured per request or per route:
  - `fetch(url, { cache: 'force-cache' })` is the equivalent of getStaticProps.
  - `fetch(url, { next: { revalidate: 60 } })` or `export const revalidate = 60` is the equivalent of ISR.
  - `fetch(url, { cache: 'no-store' })`, using `cookies()`/`headers()`, or `export const dynamic = 'force-dynamic'` is the equivalent of getServerSideProps.
  - `generateStaticParams` replaces `getStaticPaths`. `revalidateTag`/`revalidatePath` handle on-demand revalidation.
- Note: since Next 15, `fetch` is **not cached by default**, so you opt in to caching explicitly.

## Real-life example: the problem
An online electronics store built the product page with `getServerSideProps`. During a Black Friday campaign, every product view hit the origin server and the product API. TTFB went from 150 ms to 3 s and the API started returning 503s. The data (title, specs, images) changes a few times a day. Only the stock count is really live. Meanwhile, the "My orders" page was built with `getStaticProps`, so after a deploy every user saw the same cached orders list, which was a privacy bug.

```jsx
// pages/products/[slug].jsx: SSR on every request for mostly static data
export async function getServerSideProps({ params }) {
  const product = await fetch(`${API}/products/${params.slug}`).then(r => r.json());
  return { props: { product } };
}

// pages/account/orders.jsx: static page for per-user data (wrong)
export async function getStaticProps() {
  const orders = await fetch(`${API}/orders`, {
    headers: { Authorization: `Bearer ${process.env.SERVICE_TOKEN}` },
  }).then(r => r.json());
  return { props: { orders } }; // baked into HTML at build, the same for everyone
}
```

## How to fix it
**Pages Router version:**
```jsx
// pages/products/[slug].jsx: ISR, served from CDN, refreshed every 5 min
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
// The live stock count is fetched client-side (SWR / React Query) inside the page.

// pages/account/orders.jsx: per request, per user
export async function getServerSideProps({ req }) {
  const session = req.cookies.session;
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  const orders = await fetch(`${API}/me/orders`, {
    headers: { Cookie: `session=${session}` },
  }).then(r => r.json());
  return { props: { orders } };
}
```

**App Router equivalent:**
```jsx
// app/products/[slug]/page.jsx
export const revalidate = 300;                     // ISR for the route

export async function generateStaticParams() {
  const top = await fetch(`${API}/products?top=200`).then(r => r.json());
  return top.map(p => ({ slug: p.slug }));
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = await fetch(`${API}/products/${slug}`, {
    next: { revalidate: 300, tags: [`product:${slug}`] },
  }).then(r => r.json());
  return <ProductView product={product} />;      // stock: client component polling /api/stock
}

// app/account/orders/page.jsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function OrdersPage() {
  const session = (await cookies()).get('session')?.value; // makes the route dynamic
  if (!session) redirect('/login');
  const orders = await fetch(`${API}/me/orders`, {
    headers: { Cookie: `session=${session}` },
    cache: 'no-store',
  }).then(r => r.json());
  return <OrdersList orders={orders} />;
}
```

When the CMS updates a product, a webhook route calls `revalidateTag('product:' + slug)` so the page updates immediately instead of waiting 5 minutes.

Why it works: shared, slowly changing data is served from the CDN, so the origin handles one regeneration per product per 5 minutes instead of every page view. Per-user data is always rendered per request with the user's own credentials, never baked into shared HTML.

## How to say it in the interview
- "The question I ask is: is this data the same for every user, and how fresh does it need to be? Same and stale-tolerant means static or ISR; per-user or must-be-live means SSR or no-store."
- "In the App Router the same decision moves into `fetch` options and route segment config: `force-cache`, `revalidate`, `no-store`, `dynamic`."
- Trap: calling your own API route (`/api/...`) from `getServerSideProps` adds an extra network hop. Call the data source or shared function directly.
- Trade-off: ISR can serve stale data for one request after the window expires (stale-while-revalidate). Use on-demand revalidation when staleness matters (prices, stock).
