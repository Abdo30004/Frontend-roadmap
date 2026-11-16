# Establishing Code Review Processes and Quality Standards

**Level:** Senior
**Merged from (original phrasings):**
- How do you establish code review processes and maintain code quality standards?

## The concept (short answer)
- **Automate everything mechanical** so humans review design, not semicolons: Prettier for formatting, ESLint (with `react-hooks`, `jsx-a11y`, import rules) and `tsc --noEmit` in CI as **required checks**, plus pre-commit hooks (lint-staged) for fast feedback.
- **Small PRs** (ideally under ~400 changed lines) get reviewed faster and better; large features ship behind flags in slices.
- A **PR template** makes authors explain the why, show screenshots, and confirm tests; **CODEOWNERS** routes PRs to the right reviewers automatically.
- A short **review checklist** focuses reviewers on what tools cannot catch: correctness, edge cases, security, accessibility, performance, naming and architecture fit.
- **Branch protection**: at least one approval, required checks green, no direct pushes to main.
- **Culture**: review within an agreed SLA (e.g. same business day), comments are kind and specific, labeled by severity (`blocking:`, `nit:`, `question:`), and critique targets code, not people.

## Real-life example: the problem
A typical case: a 12-person team on a SaaS dashboard. PRs sit for three days, then get "LGTM" without comments because they are 2,000 lines. Review threads are 40 comments about trailing commas and import order, which leads to arguments. A PR that removed a `useEffect` dependency to "fix a loop" was approved and caused stale data in the billing page; another merged with a `<div onClick>` button that keyboard users cannot reach. Main is broken twice a week because someone pushed directly.

The "process" was this:

```markdown
<!-- .github/pull_request_template.md - BROKEN: empty, so PRs say "fix stuff" -->
```

```json
// package.json - BROKEN: lint exists but nothing enforces it
{
  "scripts": {
    "lint": "eslint src",
    "build": "next build"
  }
}
```
No CI checks, no CODEOWNERS, no branch protection, no shared expectations.

## How to fix it
**1. Automate style and correctness checks**
```json
// package.json
{
  "scripts": {
    "lint": "eslint . --max-warnings=0",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "lint-staged": { "*.{ts,tsx}": ["eslint --fix", "prettier --write"] }
}
```
```js
// eslint.config.js (flat config)
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',     // would have caught the stale billing data
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
```
```yaml
# .github/workflows/quality.yml
on: [pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run format:check && npm run lint && npm run typecheck && npm test
```

**2. Route and gate PRs**
```text
# .github/CODEOWNERS
*                       @acme/web-reviewers
/src/features/billing/  @acme/billing-team
/src/design-system/     @acme/design-system
/.github/workflows/     @acme/platform
```
Branch protection on `main`: require the `quality` check, 1 approval (2 for `billing/`), CODEOWNERS review, linear history, no direct pushes.

**3. A PR template that forces context**
```markdown
<!-- .github/pull_request_template.md -->
## What and why
<!-- Link the ticket. What problem does this solve? -->

## How to test
<!-- Steps, preview URL, test accounts -->

## Screenshots / recordings (UI changes)

## Checklist
- [ ] PR is focused and under ~400 lines (or explains why not)
- [ ] Tests added/updated for new behavior and edge cases
- [ ] Keyboard and screen reader checked for new UI
- [ ] No secrets, no PII in logs; user input is validated/escaped
- [ ] Feature flag used if the change is risky or incomplete
```

**4. Review guidelines (in CONTRIBUTING.md)**
- First response within one business day; pair or call if a thread exceeds ~5 back-and-forths.
- Prefix comments: `blocking:` must be fixed, `suggestion:` optional, `nit:` style preference (usually means "add a lint rule instead"), `question:` I want to understand.
- Phrase as observations and questions: "This effect reads `accountId` but doesn't list it as a dependency; could billing show the previous account's data?" instead of "This is wrong."
- Praise good solutions explicitly; review the code, not the author.

Why it works: machines enforce formatting and known bug patterns, so review time goes to logic, UX and design; small PRs plus CODEOWNERS and an SLA cut review latency; the template and checklist make missing tests or accessibility obvious before merge; severity labels and kind phrasing keep reviews from becoming status fights.

## How to say it in the interview
- "If a comment could be a lint rule, it should be a lint rule; human review is for correctness, design, security and accessibility."
- "I optimize for small PRs and fast turnaround: a one-day review SLA, CODEOWNERS routing, and required CI checks via branch protection."
- Follow-up trap: "How do you handle disagreements?" Refer to agreed standards (ADR, style guide); if none exist, the author decides on non-blocking points and we record the decision so it is not re-argued.
- Trade-off: too many required approvals and rules slow delivery; scale the rigor by risk (two reviewers for payments/auth, one for copy changes).
