# How do you implement lazy loading and route-based code splitting in React?

**Level:** Mid
**Merged from (original phrasings):**
- How do you implement lazy loading and route-based code splitting?
- How do you implement lazy loading and code splitting in React?
- How do you optimize bundle splitting for maximum performance across different routes?

## The concept (short answer)
- **Code splitting** breaks one big JS bundle into chunks that load on demand. The bundler (Vite/Rollup, webpack, Turbopack) creates a separate chunk at every dynamic `import()`.
- **`React.lazy(() => import('./Page'))`** + **`<Suspense fallback>`** renders a component whose code is loaded only when it is first rendered. The module must have a default export (or map a named export).
- **Route-level splitting** is the biggest, easiest win: users download only the code for the page they open. Next.js App Router does this automatically per route segment; with React Router, use `lazy` routes.
- **Component-level splitting** for heavy, not-always-visible parts: rich text editors, charts, maps, modals, admin-only tools. In Next.js: `next/dynamic` (with `ssr: false` for browser-only libraries).
- **Prefetch** to hide the delay: start the `import()` on hover/focus or when the browser is idle. Next.js `<Link>` prefetches visible routes in production.
- **Vendor chunks**: put stable, shared libraries (react, react-dom, router) in a separate long-cached chunk; avoid one giant "vendor" chunk that every route must download. Analyze with `rollup-plugin-visualizer` / `@next/bundle-analyzer`.
- Also handle **chunk load errors** (after a deploy, old chunk names may 404) with an Error Boundary and a reload.

## Real-life example: the problem
An online banking dashboard is a Vite + React Router SPA. Every page is imported at the top of `App.jsx`, including the PDF statement viewer (pdf.js), the investments page with a chart library, and the admin panel. The main bundle is 2.4MB. On a 4G phone the login screen takes 7 seconds to become interactive, even though users only need the login form first.

```jsx
// App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Accounts from './pages/Accounts';
import Investments from './pages/Investments';   // imports a big charting library
import Statements from './pages/Statements';     // imports pdf.js
import AdminPanel from './pages/AdminPanel';     // used by 1% of users

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Accounts />} />
        <Route path="/investments" element={<Investments />} />
        <Route path="/statements" element={<Statements />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </BrowserRouter>
  );
}
```

## How to fix it
```jsx
// App.jsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Login from './pages/Login';            // keep the entry route in the main bundle
import { RouteErrorBoundary } from './RouteErrorBoundary';

const loadAccounts = () => import('./pages/Accounts');
const loadInvestments = () => import('./pages/Investments');
const loadStatements = () => import('./pages/Statements');

const Accounts = lazy(loadAccounts);
const Investments = lazy(loadInvestments);
const Statements = lazy(loadStatements);
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

export default function App() {
  return (
    <BrowserRouter>
      <RouteErrorBoundary>                      {/* catches failed chunk loads */}
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Accounts />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/statements" element={<Statements />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}

// Prefetch on hover/focus: the chunk is usually ready before the click finishes
export function NavLinkPrefetch({ to, load, children }) {
  return (
    <Link to={to} onMouseEnter={load} onFocus={load}>
      {children}
    </Link>
  );
}
// <NavLinkPrefetch to="/investments" load={loadInvestments}>Investments</NavLinkPrefetch>

// After login, warm up the most likely next page when the browser is idle
window.requestIdleCallback?.(() => loadAccounts()); // not in older Safari, so optional call
```

```js
// vite.config.js: stable vendor chunk, long cache, heavy libs stay with their route
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) {
            return 'react-vendor'; // changes rarely -> stays in the browser cache across deploys
          }
          // pdf.js and the chart library are NOT listed: they end up only in the
          // Statements / Investments chunks, so other routes never download them
        },
      },
    },
  },
};
```
Why it works: the login page now ships only the login code plus the shared React chunk. Each route downloads its own chunk the first time it is visited, and heavy libraries only load with the page that uses them. Prefetching on hover/idle hides the network delay, so navigation still feels instant. The separate React vendor chunk keeps its hash across deploys, so returning users don't download it again. The error boundary shows a "New version available, reload" message if an old chunk 404s after a deploy.

In Next.js App Router, routes are already split. For heavy components use:
```jsx
'use client'; // ssr: false is only allowed inside a Client Component
import dynamic from 'next/dynamic';

const StatementViewer = dynamic(() => import('./StatementViewer'), {
  ssr: false, loading: () => <PageSkeleton />,
});
```

## How to say it in the interview
- "I split by route first, because that's where the biggest savings are, then lazy-load heavy components that aren't visible on first paint, like editors, charts and modals."
- "`React.lazy` + `Suspense` creates a chunk per dynamic import. To avoid the loading delay I prefetch on hover, focus or idle time."
- Trap: lazy-loading everything, including small components or the above-the-fold content. That creates request waterfalls and spinners everywhere, and can make LCP worse.
- Trade-off: more chunks give smaller initial loads and better caching, but too many tiny chunks add request overhead. Use the bundle analyzer to find the big wins, and handle chunk load failures after deploys.
