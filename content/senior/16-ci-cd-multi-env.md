# Designing a Frontend CI/CD Pipeline with Multiple Environments

**Level:** Senior
**Merged from (original phrasings):**
- How do you design a CI/CD pipeline for frontend applications with multiple environments?

## The concept (short answer)
- **CI on every PR**: install with a lockfile and cache, then lint, typecheck, unit tests and build in parallel jobs; fail fast. Add E2E smoke tests against a **preview deployment** per PR so reviewers and QA click the real thing.
- **Build once, deploy many**: the exact same artifact (same hash) goes to dev, staging and prod. Environment differences (API URL, Sentry DSN, flag keys) come from **runtime config**, not from rebuilding with different `.env` files. Otherwise what you tested in staging is not what you ship.
- **Promotion**: merge to main deploys to dev automatically, then staging, then prod behind a manual approval (GitHub Environments with required reviewers), each gated by smoke tests.
- **Rollback** must be a pointer change (re-point to the previous immutable artifact / previous deployment), measured in seconds, not a rebuild.
- Secrets live in the CI secret store scoped per environment, never in the repo or the client bundle.

## Real-life example: the problem
Imagine a banking dashboard team. A release passed staging, but production showed a blank page for 40 minutes: the prod build ran `npm install` (no lockfile) and pulled a new minor version of a date library, and `VITE_API_URL` was missing in the prod build step, so the bundle called `undefined/accounts`. Rollback meant reverting the commit and waiting 15 minutes for a fresh build.

```yaml
# .github/workflows/deploy.yml - BROKEN
name: deploy
on:
  push:
    branches: [main, staging, production]   # a branch per environment
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install                       # not reproducible
      - run: npm run build                     # rebuilt per env, env vars baked in
        env:
          VITE_API_URL: ${{ vars.API_URL }}    # empty on 'production' branch
      - run: aws s3 sync dist s3://bank-dashboard-${{ github.ref_name }}
        env:
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_KEY }}
    # no lint, no tests, no typecheck, no approval, no rollback plan
```

## How to fix it
```yaml
# .github/workflows/ci.yml - runs on every PR
name: ci
on: [pull_request]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  checks:
    runs-on: ubuntu-latest
    strategy:
      matrix: { task: [lint, typecheck, 'test -- --coverage'] }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run ${{ matrix.task }}
  preview:
    needs: checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - id: deploy                              # unique preview URL per PR
        run: echo "url=$(npx vercel deploy --yes --token=${{ secrets.VERCEL_TOKEN }})" >> "$GITHUB_OUTPUT"
      - run: npx playwright install --with-deps && BASE_URL=${{ steps.deploy.outputs.url }} npm run e2e:smoke
```

```yaml
# .github/workflows/release.yml - build once on main, promote the same artifact
name: release
on: { push: { branches: [main] } }
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.v.outputs.version }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci && npm run build            # NO environment-specific vars
      - id: v
        run: echo "version=${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"
      - run: aws s3 sync dist s3://artifacts/dashboard/${{ steps.v.outputs.version }}/

  deploy-dev:
    needs: build
    uses: ./.github/workflows/deploy-env.yml
    with: { env: dev, version: '${{ needs.build.outputs.version }}' }
    secrets: inherit
  deploy-staging:
    needs: deploy-dev
    uses: ./.github/workflows/deploy-env.yml
    with: { env: staging, version: '${{ needs.build.outputs.version }}' }
    secrets: inherit
  deploy-prod:
    needs: deploy-staging
    uses: ./.github/workflows/deploy-env.yml   # its job sets `environment: production`
    with: { env: production, version: '${{ needs.build.outputs.version }}' }
    secrets: inherit
```
`deploy-env.yml` declares `environment: ${{ inputs.env }}` (so production waits for a required reviewer), uses OIDC to assume a cloud role (no long-lived keys), copies the immutable artifact to the env bucket, writes the env's `config.json`, invalidates the CDN, and runs a smoke test.

```ts
// Runtime config: loaded before the app boots, served per environment
// public/config.json on prod: { "apiUrl": "https://api.bank.example", "sentryDsn": "..." }
const config = await fetch('/config.json', { cache: 'no-store' }).then((r) => r.json());
createRoot(document.getElementById('root')!).render(<App config={config} />);
```

**Rollback**: re-run `deploy-env` for production with the previous `version` (or "promote previous deployment" on Vercel/Netlify). No rebuild, takes seconds.

Why it works: `npm ci` with a lockfile makes builds reproducible; one artifact means staging tested exactly what prod runs; config is data per environment, so a missing value is caught by a schema check on boot instead of a blank page; approvals and smoke tests gate each promotion.

## How to say it in the interview
- "I build once, tag the artifact with the commit SHA, and promote the same bytes through dev, staging and prod; only runtime config differs."
- "Every PR gets lint, typecheck, tests and a preview URL with an E2E smoke test, so review happens on the running app."
- Trap: Next.js/Vite inline `NEXT_PUBLIC_*` / `VITE_*` at build time. For build-once you need a runtime config endpoint, server-side env reading, or a placeholder-replace step at container start.
- Trade-off: full E2E on every PR is slow and flaky; keep a small smoke suite on PRs and the full suite nightly or before prod promotion.
