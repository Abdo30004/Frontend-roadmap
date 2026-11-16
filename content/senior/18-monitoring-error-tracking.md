# Monitoring and Error Tracking for Production Frontend Apps

**Level:** Senior
**Merged from (original phrasings):**
- How do you set up monitoring and error tracking for production frontend apps?

## The concept (short answer)
- Three layers: **error tracking** (uncaught exceptions, unhandled rejections, React error boundaries, failed API calls) with a tool like Sentry, Bugsnag or Datadog RUM; **real-user monitoring (RUM)** of performance (Core Web Vitals: LCP, INP, CLS, plus TTFB) via the `web-vitals` library; and **alerting** on rates, not on individual errors.
- Minified stack traces are useless, so **upload source maps** to the error tool in CI, but **do not serve them publicly** (generate `hidden` source maps and delete them from the deploy output).
- Tag every event with a **release** (git SHA) and **environment**, so you can say "error rate jumped in release `a1b2c3d`" and correlate with deploys, and mark issues resolved "in next release".
- Attach context: user ID (not PII), route, feature flags, **breadcrumbs** (clicks, navigation, network calls before the error).
- **Filter noise**: browser extensions, `ResizeObserver loop` warnings, bots, cancelled requests, third-party scripts. Otherwise the signal drowns and people stop looking.
- Alert on things that matter: crash-free sessions dropping, error rate for a release above baseline, p75 LCP/INP regression, and route to the owning team.

## Real-life example: the problem
A typical case: a food-delivery app's checkout broke on one payment method for six hours on a Saturday. Nobody was paged; the team found out from angry reviews. When they looked, the error tool had 50,000 "issues" per day (mostly extension errors), the stack traces pointed at `main.3f9a.js:1:84213`, nobody could tell which deploy introduced the bug, and the source maps were publicly downloadable from the CDN, exposing the full source and internal API comments.

```js
// vite.config.js - BROKEN
export default defineConfig({
  build: { sourcemap: true },              // .map files deployed publicly to the CDN
});
```

```tsx
// main.tsx - BROKEN
Sentry.init({
  dsn: 'https://public@o0.ingest.sentry.io/0',
  // no release, no environment, no filtering, 100% traces in prod
  tracesSampleRate: 1.0,
});

// errors inside React render are swallowed by the default white screen,
// and fetch failures (HTTP 500) never throw, so they are never reported
const res = await fetch('/api/pay', { method: 'POST', body });
const data = await res.json();
```

## How to fix it
```js
// vite.config.js
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  build: { sourcemap: 'hidden' },                       // maps generated, no sourceMappingURL comment
  plugins: [
    react(),
    sentryVitePlugin({
      org: 'acme', project: 'web',
      authToken: process.env.SENTRY_AUTH_TOKEN,         // CI secret
      release: { name: process.env.GIT_SHA },
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },   // never deployed
    }),
  ],
});
```

```tsx
// monitoring.ts
import * as Sentry from '@sentry/react';
import { onLCP, onINP, onCLS, type Metric } from 'web-vitals';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  release: import.meta.env.VITE_GIT_SHA,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,                               // sample performance traces
  replaysOnErrorSampleRate: 1.0,                       // session replay only around errors
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration({ maskAllText: true })],
  allowUrls: [/https:\/\/(www|static)\.fooddelivery\.example/],   // drop extension/3rd-party noise
  ignoreErrors: ['ResizeObserver loop limit exceeded', 'AbortError', /^Non-Error promise rejection/],
  beforeSend(event) {
    if (event.user) delete event.user.email;           // no PII
    return event;
  },
});

function sendVital(m: Metric) {
  navigator.sendBeacon('/rum', JSON.stringify({
    name: m.name, value: m.value, rating: m.rating,
    route: location.pathname, release: import.meta.env.VITE_GIT_SHA,
  }));
}
onLCP(sendVital); onINP(sendVital); onCLS(sendVital);
```

```tsx
// App.tsx - catch render errors, report HTTP failures explicitly
<Sentry.ErrorBoundary fallback={<CheckoutError />} beforeCapture={(s) => s.setTag('area', 'checkout')}>
  <Checkout />
</Sentry.ErrorBoundary>

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  Sentry.addBreadcrumb({ category: 'api', message: `${init?.method ?? 'GET'} ${url}` });
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = new Error(`API ${res.status} ${url}`);
    Sentry.captureException(err, { tags: { endpoint: url, status: res.status } });
    throw err;
  }
  return res.json();
}
```

Alerting (configured in the tool, owned per team):
- New issue in the latest release with more than 50 users in 10 minutes: page the on-call for that area.
- Crash-free session rate below 99.5% or checkout error rate 3x the 7-day baseline: page.
- p75 INP or LCP regresses by more than 20% after a release: Slack, not page.

Why it works: hidden source maps give readable stack traces without leaking code; release tags connect each error spike to a deploy (and enable fast rollback decisions); filtering makes the issue list small enough that people read it; rate-based alerts page a human within minutes instead of waiting for reviews.

## How to say it in the interview
- "I track three things: errors, real-user performance, and business health signals like checkout success rate, all tagged with release and environment."
- "Source maps are uploaded in CI to the error tracker and deleted from the build output; production never serves them."
- Follow-up trap: `fetch` does not throw on 4xx/5xx and React only reports render errors through error boundaries; you have to capture those explicitly.
- Trade-off: more data costs money and attention. Sample traces and replays, filter noise aggressively, and alert on rates and user impact, not on every exception.
