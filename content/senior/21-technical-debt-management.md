# Managing Technical Debt in Large Codebases

**Level:** Senior
**Merged from (original phrasings):**
- What's your approach to technical debt management in large codebases?

## The concept (short answer)
- Technical debt is the extra cost future changes pay because of past shortcuts or outdated decisions. Some debt is a good trade (shipping a deadline); the problem is **invisible, unmanaged** debt that compounds.
- **Make it visible**: a **debt register** (tickets with a `tech-debt` label or a simple table) recording what, where, why it hurts, cost of delay, and a rough fix size. Back it with metrics: build time, flaky test rate, bug count per module, lead time, churn x complexity hotspots.
- **Tie it to business impact**: "checkout changes take 3x longer and caused 4 incidents this quarter" gets prioritized; "the code is ugly" does not.
- **Budget it continuously**: reserve ~15-20% of each sprint for debt, plus occasional focused projects for large items, instead of waiting for a "refactoring quarter" that never comes.
- **Boy-scout rule**: leave touched code slightly better (types, tests, extracted functions) as part of normal feature work.
- **Stop new debt at the door**: lint rules, type strictness and CI checks that block new instances of known bad patterns while the old ones are burned down (ratcheting).

## Real-life example: the problem
A typical case: a five-year-old React SaaS app. Every sprint, estimates for the "reports" area are blown; a simple filter change took two weeks and caused a regression. The codebase mixes class components, a legacy Redux store, `moment.js`, `any` everywhere, and 300 `// TODO: refactor` comments. Developers raised "we need a rewrite" in retros for a year; product always said no because nobody could explain the cost. Meanwhile, new code kept adding `moment` imports and `any`, because nothing prevented it.

The only "tracking" was this:

```tsx
// reports/ReportFilters.tsx - BROKEN: debt is invisible and keeps growing
// TODO: refactor this mess
// TODO: remove moment
// FIXME: why does this need setTimeout??
import moment from 'moment';

export function ReportFilters(props: any) {
  const range = props.range as any;
  setTimeout(() => props.onChange(moment(range.from).format('YYYY-MM-DD')), 0);
  // ...
}
```

```js
// eslint config - BROKEN: rules turned off globally to make CI pass
rules: {
  '@typescript-eslint/no-explicit-any': 'off',
  'no-restricted-imports': 'off',
}
```

## How to fix it
**1. A debt register with business impact**
```markdown
| ID  | Area     | Problem                                  | Impact (evidence)                                   | Size | Priority |
|-----|----------|------------------------------------------|-----------------------------------------------------|------|----------|
| D-1 | reports  | Untyped filters, legacy Redux + setTimeout | 4 regressions in Q3; filter changes avg 8 days vs 2 | M    | High     |
| D-2 | global   | moment.js (72 KB gz) in main bundle      | +0.4 s LCP on mobile (measured in RUM)              | M    | Medium   |
| D-3 | CI       | 9% flaky E2E tests                       | ~6 dev-hours/week re-running pipelines              | S    | High     |
```
Reviewed monthly with the product manager; the top items get scheduled in the 20% budget. Big items get an owner and a plan (milestones, metric to watch).

**2. Block new debt, burn down old debt (ratchet)**
```js
// eslint.config.js
export default [
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': ['error', {
        paths: [{ name: 'moment', message: 'Use date-fns (see ADR-012).' }],
      }],
    },
  },
  {
    // legacy files still allowed temporarily; this list may only shrink
    files: ['src/legacy/**', 'src/reports/old/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'warn', 'no-restricted-imports': 'warn' },
  },
];
```
```json
// package.json - ratchet: fail CI if the count of warnings goes UP
{ "scripts": { "lint:ratchet": "eslint . --format json -o eslint.json && node scripts/ratchet.mjs" } }
```
ESLint's bulk suppressions (`eslint --suppress-all`, which writes `eslint-suppressions.json`) or Betterer (`@betterer/cli`) do the same: record the current violations and fail if new ones appear.

**3. Boy-scout fixes inside feature work**
```tsx
// reports/ReportFilters.tsx - after touching it for a feature
import { format } from 'date-fns';

type DateRange = { from: Date; to: Date };
type Props = { range: DateRange; onChange: (from: string) => void };

export function ReportFilters({ range, onChange }: Props) {
  function apply() {
    onChange(format(range.from, 'yyyy-MM-dd'));    // event-driven, no setTimeout hack
  }
  // ...
}
```
Plus a test for the regression that was fixed. The PR description links `D-1` and notes the progress.

Why it works: the register converts complaints into prioritized, evidence-backed items product can trade off; the steady 15-20% budget keeps paying interest without stopping delivery; lint rules and ratchets stop the bleeding so burn-down actually converges; boy-scout fixes happen where developers are already working, which is exactly where debt costs the most.

## How to say it in the interview
- "I treat debt like a backlog with a business case: visible in a register, measured with things like lead time, incident count and bundle size, and prioritized with product."
- "I budget around 15-20% continuously, apply the boy-scout rule in feature work, and add lint rules so new code cannot add the same debt."
- Follow-up trap: "When would you do a rewrite?" Almost never as a big bang; prefer incremental replacement (strangler fig) with measurable milestones.
- Trade-off: not all debt is worth paying; code that rarely changes and rarely breaks can stay ugly. Focus on hotspots where change frequency and pain overlap.
