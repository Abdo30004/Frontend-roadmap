# Migrating Legacy Frontend Applications to a Modern Stack

**Level:** Senior
**Merged from (original phrasings):**
- Explain your strategy for migrating legacy frontend applications to modern tech stacks.

## The concept (short answer)
- Avoid the **big-bang rewrite**: it freezes or duplicates feature work for months, the target keeps moving, and launch day reveals every forgotten edge case at once.
- Use the **strangler-fig pattern**: put a routing layer (reverse proxy, CDN rules, or Next.js `rewrites`) in front of both apps, move **one route or feature at a time** to the new stack, and fall back to the legacy app for everything not yet migrated. The old app shrinks until it can be deleted.
- Keep the seams invisible to users: **shared auth/session** (same-domain cookie both apps understand), shared design tokens so pages look the same, and shared analytics.
- Prove equivalence with **feature-parity tests**: the same Playwright tests run against the legacy and the new route before switching traffic; release each route behind a flag or percentage rollout with a fast way back.
- Order the work by value and risk: start with a low-risk, high-traffic or high-change route to learn, leave rarely-changed screens for last (or never).
- Typical paths: jQuery/AngularJS to React (mount React islands inside the old app, or route-level split), CRA to Vite (mostly a build-tool swap, can be done in one PR), SPA to Next.js App Router (route by route behind a proxy).

## Real-life example: the problem
A typical case: an insurance customer portal built on AngularJS 1.x, which reached end of life in January 2022 and no longer gets security fixes. The team decided on a full rewrite in Next.js in a separate repo. Eighteen months later, the legacy app had kept receiving urgent features, so the rewrite was always behind. On launch weekend they switched DNS to the new app: customers with joint policies could not download their PDF documents (an undocumented legacy feature), bookmarked deep links returned 404, and users were logged out because the new app used a different session mechanism. The switch was rolled back after two days, and the rewrite lost the business's trust.

The plan looked like this:

```nginx
# nginx.conf - BROKEN: all-or-nothing cutover
server {
  server_name portal.insurer.example;
  location / {
    # flip from legacy to new in one go on launch day
    proxy_pass http://next-app:3000;      # was: http://angularjs-app:8080
  }
}
```

```js
// new app auth - BROKEN: its own login, ignores the existing session cookie
export async function middleware(req) {
  if (!req.cookies.get('next_auth_token')) {
    return Response.redirect(new URL('/login', req.url));   // legacy users are "logged out"
  }
}
```

## How to fix it
**1. One entry point, migrate route by route, fall back to legacy**
```js
// next.config.js - Next.js is the front door; unmigrated paths go to the legacy app
module.exports = {
  async rewrites() {
    return {
      // beforeFiles/afterFiles omitted; fallback runs only if no Next.js page matched
      fallback: [
        { source: '/:path*', destination: `${process.env.LEGACY_ORIGIN}/:path*` },
      ],
    };
  },
};
```
Migrated so far: `app/dashboard/page.tsx`, `app/claims/[id]/page.tsx`. Everything else (`/policies/*`, `/documents/*`) is still served by AngularJS through the fallback, on the same domain, with the same URLs, so bookmarks keep working.

**2. Shared session: the new app trusts the existing cookie**
```ts
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { verifyLegacySession } from '@/lib/session';   // validates the SAME signed cookie

const MIGRATED = ['/dashboard', '/claims'];

export async function middleware(req: NextRequest) {
  if (!MIGRATED.some((p) => req.nextUrl.pathname.startsWith(p))) return NextResponse.next();
  const session = await verifyLegacySession(req.cookies.get('PORTAL_SESSION')?.value);
  if (!session) return NextResponse.redirect(new URL('/login', req.url));  // legacy login page
  return NextResponse.next();
}
```

**3. Parity tests run against both implementations before switching a route**
```ts
// parity/claims.spec.ts - run with BASE_URL=legacy and BASE_URL=new
test('joint policy holder can download claim documents', async ({ page }) => {
  await loginAs(page, 'joint-policy-holder');
  await page.goto('/claims/C-1042');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  expect((await download).suggestedFilename()).toMatch(/C-1042.*\.pdf$/);
});
```

**4. Progressive rollout per route**
```ts
// In middleware: send a percentage of users to the new route, sticky per user
if (pathname.startsWith('/claims') && !(await isEnabled('new-claims', session.userId))) {
  return NextResponse.rewrite(new URL(pathname + req.nextUrl.search, process.env.LEGACY_ORIGIN));
}
```
Watch error rate, Web Vitals and support tickets for the migrated route; turn the flag off to roll back instantly. When a route is at 100% for a few weeks, delete its legacy code.

Why it works: users always hit one domain with one session, so the two stacks are invisible; each route ships independently with tests proving parity, so undocumented behavior is discovered one feature at a time instead of on launch day; new features are built only in the new stack, so the migration target stops moving; rollback is a flag, not a DNS change.

Alternatives: for widget-level migration inside a single page, mount React components into the legacy app (`createRoot` on a DOM node from an AngularJS directive) and grow islands outward. For CRA to Vite, a single focused PR is usually fine (move `index.html` to the root, `REACT_APP_*` to `VITE_*` / `import.meta.env`, replace Jest with Vitest gradually).

## How to say it in the interview
- "I avoid big-bang rewrites; I put a routing layer in front, migrate route by route with the legacy app as the fallback, and delete legacy code as each route reaches 100%."
- "The hidden work is the seams: shared session, same URLs, same design tokens and analytics, and parity tests that run against both versions."
- Follow-up trap: "How do you convince the business?" Show incremental value: each migrated route ships with measurable wins (faster LCP, fewer bugs, faster feature delivery), and there is never a long freeze.
- Trade-off: running two stacks for a while costs more (two builds, duplicated components, context switching). Set a clear order and end date, and stop adding features to the legacy side.
