# Frontend Interview Questions — Filtered & Deduplicated

Source: ~130 questions collected from several interview lists (junior, mid and senior).
After merging questions that test the **same concept**, there are **73 unique questions**.

Every file follows the same structure:
1. **The concept**: the short answer the interviewer expects
2. **Real-life example: the problem**: a production scenario, with the broken code
3. **How to fix it**: the fixed code and why it works
4. **How to say it in the interview**: key sentence, traps, trade-offs

Each file also lists the original phrasings it merges ("Merged from"), so you can see what was deduplicated.

---

## Junior (24)

| # | Question | Merged duplicates |
|---|----------|-------------------|
| 01 | [Closures](junior/01-closures.md) | 2 |
| 02 | [var / let / const + the `for`/`setTimeout` coding question](junior/02-var-let-const-and-loop-settimeout.md) | 4 |
| 03 | [setTimeout vs setInterval](junior/03-settimeout-vs-setinterval.md) | 1 |
| 04 | [Promises & async/await](junior/04-promises-and-async-await.md) | 2 |
| 05 | [Array methods (map, filter, reduce, forEach)](junior/05-array-methods.md) | 1 |
| 06 | [Event listeners & event delegation](junior/06-event-listeners-and-delegation.md) | 1 |
| 07 | [Props vs state](junior/07-props-vs-state.md) | 1 |
| 08 | [useState vs useReducer](junior/08-usestate-vs-usereducer.md) | 1 |
| 09 | [Class vs functional components](junior/09-class-vs-functional-components.md) | 1 |
| 10 | [Hooks & custom hooks](junior/10-hooks-and-custom-hooks.md) | 1 |
| 11 | [Routing with react-router-dom](junior/11-routing-react-router.md) | 1 |
| 12 | [Flexbox vs Grid](junior/12-flexbox-vs-grid.md) | 2 |
| 13 | [Responsive design](junior/13-responsive-design.md) | 3 |
| 14 | [Web accessibility (WCAG)](junior/14-web-accessibility.md) | 2 |
| 15 | [Storybook & component-driven architecture](junior/15-storybook-and-component-driven-architecture.md) | 2 |
| 16 | [REST vs GraphQL](junior/16-rest-vs-graphql.md) | 1 |
| 17 | [Git & collaboration](junior/17-git-version-control.md) | 1 |
| 18 | [npm vs yarn](junior/18-npm-vs-yarn.md) | 1 |
| 19 | [What is Next.js & its advantages over React](junior/19-nextjs-and-advantages-over-react.md) | 2 |
| 20 | [Unit testing with Jest & RTL](junior/20-unit-testing-jest-rtl.md) | 1 |
| 21 | [E2E testing (Cypress / Selenium / Playwright)](junior/21-e2e-testing-cypress.md) | 1 |
| 22 | [Debugging JS & React](junior/22-debugging-js-and-react.md) | 1 |
| 23 | [Coding: Product Search component](junior/23-coding-product-search-component.md) | 1 |
| 24 | [Coding: Complete frontend app](junior/24-coding-complete-frontend-app.md) | 1 |

## Mid (26)

| # | Question | Merged duplicates |
|---|----------|-------------------|
| 01 | [Event loop, microtasks & rendering](mid/01-event-loop-microtasks-rendering.md) | 2 |
| 02 | [Debounce, throttle & high-frequency events](mid/02-debounce-throttle-high-frequency-events.md) | 2 |
| 03 | [useEffect vs useLayoutEffect](mid/03-useeffect-vs-uselayouteffect.md) | 1 |
| 04 | [useEffect cleanup & unmounting](mid/04-useeffect-cleanup-and-unmounting.md) | 2 |
| 05 | [Why `setCount(count + 1)` ×3 adds only 1](mid/05-state-batching-setcount-three-times.md) | 1 |
| 06 | [Stale closure in `useEffect([])`](mid/06-stale-closure-in-useeffect.md) | 1 |
| 07 | [Array index as key](mid/07-array-index-as-key.md) | 1 |
| 08 | [Unnecessary re-renders & when memo fails](mid/08-unnecessary-rerenders-and-memo.md) | 2 |
| 09 | [React performance optimization techniques](mid/09-react-performance-optimization-techniques.md) | 3 |
| 10 | [Context API & the re-render problem](mid/10-context-api-and-rerender-problem.md) | 2 |
| 11 | [Forms, validation, controlled vs uncontrolled](mid/11-forms-validation-controlled-uncontrolled.md) | 2 |
| 12 | [Data-fetching hook: race conditions, cancellation, retries](mid/12-data-fetching-hook-race-conditions-retries.md) | 3 |
| 13 | [Lazy loading & code splitting](mid/13-lazy-loading-code-splitting.md) | 3 |
| 14 | [Large lists (5k / 10k / 50k rows) & virtualization](mid/14-large-lists-virtualization.md) | 3 |
| 15 | [SSR vs CSR vs hydration](mid/15-ssr-csr-hydration.md) | 4 |
| 16 | [Next.js data fetching (getStaticProps / getServerSideProps)](mid/16-nextjs-data-fetching-getstaticprops-getserversideprops.md) | 1 |
| 17 | [BFF (Backend for Frontend)](mid/17-bff-backend-for-frontend.md) | 1 |
| 18 | [Monorepo & shared dependencies](mid/18-monorepo-and-shared-dependencies.md) | 2 |
| 19 | [API takes 5 s: what does the user see?](mid/19-slow-api-loading-ux.md) | 1 |
| 20 | [Double-click on "Pay" (idempotency)](mid/20-double-click-pay-idempotency.md) | 1 |
| 21 | [Authentication & authorization](mid/21-authentication-authorization.md) | 1 |
| 22 | [Memory leaks in React](mid/22-memory-leaks-react.md) | 1 |
| 23 | [XSS & CSRF protection](mid/23-xss-csrf-protection.md) | 1 |
| 24 | [Env config without leaking secrets](mid/24-env-config-secrets.md) | 1 |
| 25 | [Why Error Boundaries miss async errors](mid/25-error-boundary-async-failures.md) | 1 |
| 26 | [Multi-tab logout sync](mid/26-multi-tab-logout-sync.md) | 1 |

## Senior (23)

| # | Question | Merged duplicates |
|---|----------|-------------------|
| 01 | [Virtual DOM, reconciliation & Fiber](senior/01-virtual-dom-reconciliation-fiber.md) | 2 |
| 02 | [From setState to pixels (browser rendering pipeline)](senior/02-setstate-to-pixels-rendering-pipeline.md) | 2 |
| 03 | [React 18 concurrent features](senior/03-react-concurrent-features.md) | 1 |
| 04 | [State management architecture (Redux / Zustand / Context / server state)](senior/04-state-management-architecture.md) | 3 |
| 05 | [Centralized error handling & retries](senior/05-centralized-error-handling-retries.md) | 1 |
| 06 | [Efficient data-fetching patterns](senior/06-data-fetching-patterns.md) | 1 |
| 07 | [Bundle grew 500 KB → 5 MB](senior/07-bundle-size-explosion.md) | 2 |
| 08 | [Slow page / slow on real Android / web performance](senior/08-slow-page-and-real-device-performance.md) | 3 |
| 09 | [Caching layers: browser, CDN, SW, API](senior/09-caching-layers.md) | 1 |
| 10 | [Server vs Client Components boundary](senior/10-server-vs-client-components.md) | 1 |
| 11 | [Server Actions vs API routes](senior/11-server-actions-vs-api-routes.md) | 1 |
| 12 | [Real-time (WebSocket / SSE) & out-of-order messages](senior/12-realtime-websocket-sse-ordering.md) | 2 |
| 13 | [PWA, offline & data sync](senior/13-pwa-offline-sync.md) | 3 |
| 14 | [Micro-frontends](senior/14-micro-frontends.md) | 1 |
| 15 | [Design system at scale](senior/15-design-system-at-scale.md) | 1 |
| 16 | [CI/CD with multiple environments](senior/16-ci-cd-multi-env.md) | 1 |
| 17 | [Feature flags & A/B testing](senior/17-feature-flags-ab-testing.md) | 2 |
| 18 | [Monitoring & error tracking](senior/18-monitoring-error-tracking.md) | 1 |
| 19 | [Reproducing a bug that hits 1% of users](senior/19-reproducing-rare-production-bugs.md) | 1 |
| 20 | [Code review & quality standards](senior/20-code-review-and-quality-standards.md) | 1 |
| 21 | [Technical debt management](senior/21-technical-debt-management.md) | 1 |
| 22 | [Mentoring & technical interviews](senior/22-mentoring-and-technical-interviews.md) | 1 |
| 23 | [Legacy frontend migration](senior/23-legacy-migration.md) | 1 |

---

### What was removed
- Exact duplicates, such as var/let/const, closures, async/await, responsive design and accessibility, which appeared in two or three lists.
- Same-concept variants, such as "10k items lag", "50k-row table" and "5k-row list janky", which all become one virtualization file. "SSR", "SSR vs CSR", "SSR + hydration" and "SSR in Next.js" become one file.
- Non-question text from the source posts, such as scoring rubrics, preparation advice and handbook ads.
