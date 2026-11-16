# Investigating a Bundle Size Explosion

**Level:** Senior
**Merged from (original phrasings):**
- Your JavaScript bundle grew from 500 KB to 5 MB. Where do you start?
- Your bundle size doubled and Core Web Vitals dropped. Where do you start?

## The concept (short answer)

- **Measure before guessing:** build with a bundle analyzer (`@next/bundle-analyzer`, `webpack-bundle-analyzer`, `rollup-plugin-visualizer` for Vite, `source-map-explorer`) and look at the treemap of the **initial** chunk per route. Compare against the last good build (`git bisect` on bundle size if needed).
- **Usual suspects, in order of frequency:**
  1. **Full-library imports:** `moment` (+ all locales), `import _ from 'lodash'` (CommonJS, not tree-shakeable), icon packs, `aws-sdk` v2.
  2. **Barrel files** (`index.ts` re-exporting everything) that pull whole folders, especially if any module has side effects, defeating tree-shaking.
  3. **Heavy components loaded eagerly:** chart libs, rich-text editors, PDF viewers, maps used in one modal or one route.
  4. **Duplicated dependencies:** two versions of the same lib because of semver mismatches (`npm ls <pkg>`, analyzer shows it twice).
  5. **Server-only code leaking to the client:** a `"use client"` too high in a Next.js tree, or a shared util importing a big SDK.
- **Why it hurts Web Vitals:** JS is the most expensive byte - download, then parse/compile/execute on the main thread. Big bundles delay hydration (INP, slow interactivity) and often LCP when the hero depends on JS.
- **Prevent regressions:** a size budget in CI (`size-limit`, bundlewatch) that fails the PR and comments the diff.

## Real-life example: the problem

A SaaS analytics dashboard. Over two quarters the main bundle went from 500 KB to 5 MB (1.4 MB gzipped). Field data shows mobile INP went from "good" to 450ms and LCP regressed by 2s on the login page - which shows a form and nothing else. The analyzer treemap reveals moment with 160 locales, all of lodash twice (lodash + lodash-es), the full `echarts` build and a Monaco editor in the entry chunk.

```js
// utils/date.js
import moment from 'moment';                       // ~290 KB with locales
export const fmt = (d) => moment(d).format('DD MMM YYYY');

// utils/array.js
import _ from 'lodash';                            // entire CJS lodash (~70 KB min)
export const uniqBy = (arr, k) => _.uniqBy(arr, k);

// components/index.ts  (barrel)
export * from './Button';
export * from './Input';
export * from './RevenueChart';                    // imports 'echarts' (whole build)
export * from './SqlEditor';                       // imports 'monaco-editor'

// app/login/page.tsx
import { Button, Input } from '@/components';     // login now depends on echarts + monaco
```

```json
{
  "dependencies": { "date-fns": "^2.30.0", "some-ui-kit": "^4.1.0" }
}
```

(`some-ui-kit` depends on `date-fns@^3`, so both versions ship.)

## How to fix it

1. Find it: `ANALYZE=true next build` (or `npx vite-bundle-visualizer`) and `npm ls date-fns lodash`.
2. Replace and narrow imports:

```js
// utils/date.js - native Intl, zero KB
const fmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
export const formatDate = (d) => fmt.format(new Date(d));

// utils/array.js - ESM, tree-shakeable, one function
import uniqBy from 'lodash-es/uniqBy';
export { uniqBy };
```

3. Import directly instead of from the barrel (or let the framework rewrite it), and lazy-load heavy widgets:

```tsx
// app/login/page.tsx
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

// app/reports/RevenueSection.tsx
'use client';
import dynamic from 'next/dynamic';
const RevenueChart = dynamic(() => import('@/components/RevenueChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const SqlEditor = dynamic(() => import('@/components/SqlEditor'), { ssr: false });
```

```js
// next.config.js - rewrites barrel imports to direct paths at build time
module.exports = {
  experimental: { optimizePackageImports: ['@/components', 'lucide-react'] },
};
```

```jsonc
// package.json of the internal components package: tells the bundler unused modules can be dropped
{ "sideEffects": ["*.css"] }
```

4. Deduplicate: upgrade our own `date-fns` to the same major as the UI kit (or use `overrides`/`resolutions`), then `npm dedupe`.

5. Lock it in with a CI budget:

```json
{
  "scripts": { "size": "size-limit" },
  "size-limit": [
    { "name": "login route", "path": ".next/static/chunks/app/login/*.js", "limit": "120 KB" },
    { "name": "shared framework", "path": ".next/static/chunks/framework-*.js", "limit": "60 KB" }
  ]
}
```

```yaml
# .github/workflows/size.yml
- run: npm ci && npm run build
- run: npx size-limit          # fails the PR when a budget is exceeded
```

Why it works: the analyzer turns guessing into a ranked list; native `Intl` and per-method ESM imports remove dead weight; direct imports and `sideEffects` let tree-shaking work; `dynamic()` moves editor and charts into chunks loaded only when the user opens those views; the budget makes the next regression visible in the PR that causes it, not two quarters later.

## How to say it in the interview

- "I never guess: analyzer first, look at the initial chunk of the worst route, diff against the last good build. Then I attack the top three offenders by size."
- "The usual culprits are whole-library imports, barrel files defeating tree-shaking, eager heavy components and duplicate versions; fixes are narrower imports, code splitting by route and interaction, dedupe, and a CI size budget."
- Trap: gzipped size is not the real cost - a 400 KB-gzipped bundle can be 1.5 MB of JS to parse and execute on a slow phone. Measure execution time too.
- Trade-off: over-splitting creates many small requests and loading spinners on interaction; split at route and "heavy, rarely used" boundaries, and prefetch chunks the user is likely to need next.
