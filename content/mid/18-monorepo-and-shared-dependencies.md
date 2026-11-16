# What is a monorepo, and how do you handle shared dependencies in it?

**Level:** Mid
**Merged from (original phrasings):**
- What is a Monorepo?
- What's your approach to handling shared dependencies in a monorepo?

## The concept (short answer)
- A **monorepo** is a single Git repository that holds multiple projects (apps and packages), for example `apps/web`, `apps/admin`, `packages/ui`, `packages/utils`, `packages/eslint-config`. This is different from a **monolith**: the projects stay independently buildable and deployable.
- **Benefits:** atomic changes across packages (change a component and its consumers in one PR), shared tooling and configs, no publishing internal packages to npm just to use them, and easier refactoring.
- **Costs:** CI must be smart (build and test only what changed), the repo grows, and dependency hygiene matters.
- **Tooling:** workspaces (pnpm, npm or Yarn) link local packages together. A task runner such as **Turborepo** or **Nx** runs tasks in dependency order, caches results locally and remotely, and with `--filter`/`affected` runs only what changed.
- **Shared dependencies strategy:**
  - Libraries like `packages/ui` declare `react` and `react-dom` as **peerDependencies** ("the app provides React") and as devDependencies for their own tests. They never use regular `dependencies` for these.
  - Keep **one version** of each framework across the repo: pnpm `catalog:`, `syncpack`, or Renovate grouping. pnpm's strict `node_modules` stops "phantom dependencies" (importing a package you never declared).
  - Internal packages use `"workspace:*"` so they always resolve to the local source.

## Real-life example: the problem
A company's monorepo has `apps/web` (React 19) and `packages/ui`, a design-system package. A developer added `react` to `packages/ui` **dependencies** with a different version range. After install, the web app crashes on any page that uses `<Dropdown>` with:

```
Invalid hook call. Hooks can only be called inside of the body of a function component.
... 3. You might have more than one copy of React in the same app
```

There are now two copies of React: `node_modules/react` (used by the app) and `packages/ui/node_modules/react` (used by the UI package). Hooks in `Dropdown` call into a React instance whose dispatcher was never set by the renderer, so they fail. Context providers from the app are also invisible to the UI components.

```jsonc
// packages/ui/package.json (broken)
{
  "name": "@acme/ui",
  "version": "1.0.0",
  "main": "src/index.ts",
  "dependencies": {
    "react": "^18.2.0",          // a second, different React gets installed for this package
    "react-dom": "^18.2.0",
    "clsx": "^2.1.0"
  }
}
```

```jsonc
// apps/web/package.json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@acme/ui": "1.0.0"          // may resolve from npm instead of the local package
  }
}
```

Diagnose with `pnpm why react` (or `npm ls react`): it shows two versions.

## How to fix it
```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
catalog:
  react: ^19.0.0
  react-dom: ^19.0.0
  typescript: ^5.6.0
```

```jsonc
// packages/ui/package.json (fixed)
{
  "name": "@acme/ui",
  "private": true,
  "main": "src/index.ts",
  "peerDependencies": {
    "react": "^18.3.0 || ^19.0.0",
    "react-dom": "^18.3.0 || ^19.0.0"
  },
  "devDependencies": {
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "dependencies": {
    "clsx": "^2.1.0"
  }
}
```

```jsonc
// apps/web/package.json (fixed)
{
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:",
    "@acme/ui": "workspace:*"     // always the local package
  }
}
```

```jsonc
// turbo.json: build packages before apps, cache outputs, run only affected projects in CI
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "test":  { "dependsOn": ["^build"] },
    "lint":  {}
  }
}
```

CI: `pnpm turbo run build test lint --filter=...[origin/main]` builds and tests only the packages changed since `main` and their dependents.

Why it works: as a peer dependency, React is resolved from the consuming app, so there is exactly one React instance and hook calls and context work. The catalog gives every package the same version from one place. `workspace:*` guarantees local linking, and Turborepo's graph-aware caching keeps CI fast as the repo grows.

Alternatives: Nx (stronger code generation, module-boundary lint rules, affected graph); npm or Yarn workspaces with `overrides`/`resolutions` to force one version; `syncpack` to lint version mismatches in CI.

## How to say it in the interview
- "A monorepo is one repo with many independently deployable projects. Workspaces handle linking, and Turborepo or Nx handle task orchestration, caching and affected-only CI."
- "Singletons like React, styled-components or a router go in peerDependencies of shared libraries. Otherwise you get duplicate instances and the classic 'Invalid hook call' or lost context."
- Follow-up: "How do you stop teams from importing each other's internals?" Use package `exports` fields plus Nx module-boundary rules or ESLint `no-restricted-imports`, plus CODEOWNERS per package.
- Trade-off: a single version policy makes upgrades all-or-nothing (upgrading React means touching every app), but it is far cheaper than debugging version drift.
