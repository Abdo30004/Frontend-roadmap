# What is the difference between npm and Yarn?

**Level:** Junior
**Merged from (original phrasings):**
- Explain the difference between npm and yarn.

## The concept (short answer)
- Both are **package managers** for the JavaScript ecosystem: they read `package.json`, download packages from the npm registry, install them into `node_modules`, and run scripts (`npm run dev` / `yarn dev`).
- **npm** ships with Node.js, so it is always available. Lockfile: `package-lock.json`.
- **Yarn** was created by Facebook in 2016 to fix npm's speed and non-deterministic installs at the time. Lockfile: `yarn.lock`. Yarn Classic (v1) is in maintenance; Yarn Berry (v2+) adds Plug'n'Play (no `node_modules`) and zero-installs.
- Today the gap is small: modern npm (v7+) also has lockfiles, workspaces and parallel downloads. Differences are mostly CLI syntax (`npm install x` vs `yarn add x`), lockfile format and monorepo features.
- **pnpm** is a popular third option: a global content-addressable store with hard links, so it is fast and disk-efficient, and it uses a strict `node_modules` that blocks importing packages you did not declare ("phantom dependencies"). Lockfile: `pnpm-lock.yaml`.
- The most important concept: the **lockfile** pins the exact resolved version of every direct and transitive dependency. `package.json` says `"^4.17.0"` (a range); the lockfile says `4.17.21` exactly. Commit it, and use the clean-install command in CI.
- Pick **one** manager per project. Corepack + the `packageManager` field in `package.json` enforces the version.

## Real-life example: the problem
A typical "works on my machine" case: a React dashboard builds fine on every developer's laptop, but the CI build and the production deploy fail with `TypeError: Cannot read properties of undefined` inside a chart library. Root cause:
- `package-lock.json` was in `.gitignore` ("it causes merge conflicts").
- `package.json` uses caret ranges, so CI resolved a newly published minor version of a transitive dependency that had a breaking bug. Developers still had the old version in their local `node_modules`.
- One developer used Yarn and another used npm, so both `yarn.lock` and `package-lock.json` were drifting apart.

```gitignore
# .gitignore
node_modules/
package-lock.json   # <- the bug
yarn.lock
```

```json
{
  "name": "sales-dashboard",
  "dependencies": {
    "react": "^18.2.0",
    "chart-lib": "^3.1.0"
  }
}
```

```yaml
# CI step
- run: npm install    # resolves ranges fresh every time, may update versions
- run: npm run build
```

## How to fix it
```gitignore
# .gitignore: ignore installed packages, NEVER the lockfile
node_modules/
```

```json
{
  "name": "sales-dashboard",
  "packageManager": "npm@10.8.2",
  "engines": { "node": ">=20" },
  "dependencies": {
    "react": "^18.3.1",
    "chart-lib": "^3.1.0"
  }
}
```

```yaml
# CI step
- uses: actions/setup-node@v4
  with: { node-version: 20, cache: npm }
- run: npm ci          # installs EXACTLY what package-lock.json says; fails if out of sync
- run: npm run build
```

Steps taken:
1. Delete the stray `yarn.lock`, keep one manager, commit `package-lock.json`.
2. Use `npm ci` in CI (Yarn: `yarn install --frozen-lockfile` / Berry: `yarn install --immutable`; pnpm: `pnpm install --frozen-lockfile`).
3. Upgrade dependencies deliberately (`npm outdated`, `npm update`, or Renovate/Dependabot PRs) so new versions go through CI and review.
4. Merge conflicts in the lockfile: resolve `package.json` first, then run `npm install` to regenerate the lockfile; do not hand-edit it.

Why it works: with the lockfile committed and a clean install command, every laptop, CI run and production build installs the identical dependency tree, so "it works on my machine" means it works everywhere.

Command cheat sheet:

| Task | npm | Yarn | pnpm |
|---|---|---|---|
| Install all | `npm install` | `yarn` | `pnpm install` |
| Add dep | `npm install axios` | `yarn add axios` | `pnpm add axios` |
| Add dev dep | `npm install -D vitest` | `yarn add -D vitest` | `pnpm add -D vitest` |
| CI install | `npm ci` | `yarn install --frozen-lockfile` | `pnpm install --frozen-lockfile` |
| Run script | `npm run build` | `yarn build` | `pnpm build` |
| One-off binary | `npx create-vite` | `yarn dlx create-vite` | `pnpm dlx create-vite` |

## How to say it in the interview
- "npm and Yarn do the same job: install packages from the npm registry and run scripts. Yarn originally won on speed and deterministic installs, but modern npm closed most of that gap; pnpm is now popular for speed, disk usage and strict dependencies."
- Stress the lockfile: commit it, use one package manager per repo, and run `npm ci` (or the frozen-lockfile equivalent) in CI.
- Follow-up: "`^` vs `~`?" `^1.2.3` allows minor and patch updates (<2.0.0); `~1.2.3` allows patch only (<1.3.0).
- Trade-off: pnpm's strictness can break older packages that rely on hoisting; Yarn PnP gives fast installs but some tools need extra config.
