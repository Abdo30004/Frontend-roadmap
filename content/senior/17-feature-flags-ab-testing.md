# Feature Flags and A/B Testing in Large React Applications

**Level:** Senior
**Merged from (original phrasings):**
- What's your approach to implementing feature flags in large frontend applications?
- Explain your strategy for A/B testing in React applications.

## The concept (short answer)
- A **feature flag** decouples deploy from release: code ships dark and is turned on per user, segment or percentage, with a kill switch. An **A/B test** is a flag with several variants plus a metric and a statistical analysis.
- Use a **flag provider** (LaunchDarkly, Unleash, GrowthBook, Statsig, Flagsmith, or an in-house service) behind your own thin wrapper (`useFlag('new-checkout')`), so the vendor can be swapped and flags are typed.
- **Flicker**: if flags are fetched in the browser after first paint, users see control, then the variant jumps in. Fix by **evaluating on the server** (Server Components, middleware, edge) or bootstrapping flag values into the HTML, and gating rendering until flags are known.
- **Sticky assignment**: bucket by a stable ID (user ID, or an anonymous ID cookie set at the edge) with deterministic hashing, so a user sees the same variant across reloads and devices.
- **Measure correctly**: log an exposure event when the variant is actually rendered, define a primary metric and guardrail metrics up front, run to a pre-computed sample size, and do not peek and stop early.
- **Flags are debt**: every flag gets an owner and an expiry date; stale flags are removed (lint rules, dashboards of flags at 100% for 30+ days).

## Real-life example: the problem
Imagine an e-commerce checkout A/B test: "one-page checkout" vs. the current three-step checkout. Results looked great for the variant, but support tickets said "the page changed while I was typing". The team found: (1) users saw the old checkout for ~400 ms and then it swapped, sometimes after they had started typing; (2) assignment used `Math.random()` on each page load, so the same user flipped between variants and was counted in both; (3) conversions were attributed to everyone who loaded the bundle, not to who actually saw the variant. A year later the codebase still contained 140 flags, many permanently on, with nested `if` branches nobody dared to delete.

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

Why it works: the server decides the variant before HTML is sent, so there is no flicker and no layout shift; hashing a stable ID gives sticky, evenly-split buckets; exposure events make the analysis count only users who saw the variant; the registry and CI check turn flag cleanup into a routine task instead of archaeology.

Alternatives: for a pure client SPA, bootstrap flags in a `<script>` in the HTML or block render behind a short skeleton with a timeout fallback to control. Edge-side rewrites (middleware rewriting to `/checkout/onepage`) also avoid flicker and keep pages cacheable per variant.

## How to say it in the interview
- "Flags separate deploy from release; I wrap the provider in a typed hook/helper, evaluate on the server to avoid flicker, and bucket by a stable ID so assignment is sticky."
- "For experiments: pre-register the primary and guardrail metrics, log exposure at render time, compute the sample size, and do not stop early when the graph looks good."
- Follow-up trap: "What about caching?" Server-evaluated variants break shared CDN caching; vary the cache by a variant cookie or rewrite to variant-specific paths.
- Trade-off: flags add branches and test combinations. Keep them short-lived, give each an owner and expiry, and delete the losing branch right after the decision.
