# Qu'est-ce qu'un monorepo, et comment y gérer les dépendances partagées ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Qu'est-ce qu'un monorepo ?
- Quelle est votre approche pour gérer les dépendances partagées dans un monorepo ?

## The concept (short answer)
- Un **monorepo** est un dépôt Git unique qui contient plusieurs projets (applications et packages), par exemple `apps/web`, `apps/admin`, `packages/ui`, `packages/utils`, `packages/eslint-config`. Ce n'est pas la même chose qu'un **monolithe** : les projets restent buildables et déployables indépendamment.
- **Avantages :** des changements atomiques sur plusieurs packages (modifier un composant et ses consommateurs dans une seule PR), des outils et des configurations partagés, pas besoin de publier les packages internes sur npm juste pour les utiliser, et un refactoring plus simple.
- **Inconvénients :** la CI doit être intelligente (ne builder et tester que ce qui a changé), le dépôt grossit, et l'hygiène des dépendances devient importante.
- **Outillage :** les workspaces (pnpm, npm ou Yarn) relient les packages locaux entre eux. Un task runner comme **Turborepo** ou **Nx** exécute les tâches dans l'ordre des dépendances, met les résultats en cache localement et à distance, et avec `--filter`/`affected` n'exécute que ce qui a changé.
- **Stratégie pour les dépendances partagées :**
  - Les bibliothèques comme `packages/ui` déclarent `react` et `react-dom` en **peerDependencies** (« c'est l'application qui fournit React ») et en devDependencies pour leurs propres tests. Elles ne les mettent jamais dans les `dependencies` classiques.
  - Gardez **une seule version** de chaque framework dans tout le dépôt : `catalog:` de pnpm, `syncpack`, ou le regroupement des mises à jour dans Renovate. Le `node_modules` strict de pnpm empêche les « dépendances fantômes » (importer un package que vous n'avez jamais déclaré).
  - Les packages internes utilisent `"workspace:*"` pour toujours pointer vers le code source local.

## Real-life example: the problem
Le monorepo d'une entreprise contient `apps/web` (React 19) et `packages/ui`, un package de design system. Un développeur a ajouté `react` dans les **dependencies** de `packages/ui` avec une plage de versions différente. Après l'installation, l'application web plante sur toutes les pages qui utilisent `<Dropdown>` avec :

```
Invalid hook call. Hooks can only be called inside of the body of a function component.
... 3. You might have more than one copy of React in the same app
```

Il y a désormais deux copies de React : `node_modules/react` (utilisée par l'application) et `packages/ui/node_modules/react` (utilisée par le package UI). Les hooks de `Dropdown` appellent une instance de React dont le dispatcher n'a jamais été initialisé par le renderer, donc ils échouent. Les context providers de l'application sont eux aussi invisibles pour les composants UI.

```jsonc
// packages/ui/package.json (cassé)
{
  "name": "@acme/ui",
  "version": "1.0.0",
  "main": "src/index.ts",
  "dependencies": {
    "react": "^18.2.0",          // un second React, différent, est installé pour ce package
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
    "@acme/ui": "1.0.0"          // peut être résolu depuis npm au lieu du package local
  }
}
```

Diagnostiquez avec `pnpm why react` (ou `npm ls react`) : la commande affiche deux versions.

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
// packages/ui/package.json (corrigé)
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
// apps/web/package.json (corrigé)
{
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:",
    "@acme/ui": "workspace:*"     // toujours le package local
  }
}
```

```jsonc
// turbo.json : builder les packages avant les applications, mettre les sorties en cache, n'exécuter en CI que les projets affectés
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "test":  { "dependsOn": ["^build"] },
    "lint":  {}
  }
}
```

CI : `pnpm turbo run build test lint --filter=...[origin/main]` ne builde et ne teste que les packages modifiés depuis `main` ainsi que ceux qui en dépendent.

Pourquoi ça marche : en tant que peer dependency, React est résolu depuis l'application consommatrice, il n'y a donc qu'une seule instance de React, et les appels de hooks comme le context fonctionnent. Le catalog donne la même version à tous les packages depuis un seul endroit. `workspace:*` garantit le lien local, et le cache de Turborepo, qui connaît le graphe de dépendances, garde une CI rapide à mesure que le dépôt grandit.

Alternatives : Nx (génération de code plus poussée, règles de lint sur les frontières entre modules, graphe des projets affectés) ; les workspaces npm ou Yarn avec `overrides`/`resolutions` pour forcer une version unique ; `syncpack` pour détecter en CI les incohérences de versions.

## How to say it in the interview
- « Un monorepo, c'est un seul dépôt avec de nombreux projets déployables indépendamment. Les workspaces gèrent les liens entre packages, et Turborepo ou Nx gèrent l'orchestration des tâches, le cache et une CI limitée aux projets affectés. »
- « Les singletons comme React, styled-components ou un router vont dans les peerDependencies des bibliothèques partagées. Sinon vous obtenez des instances dupliquées et le classique « Invalid hook call » ou un context perdu. »
- Question de suivi : « Comment empêchez-vous les équipes d'importer le code interne des autres ? » Avec le champ `exports` des packages, plus les règles de frontières de modules de Nx ou `no-restricted-imports` d'ESLint, plus un CODEOWNERS par package.
- Compromis : une politique de version unique rend les mises à jour « tout ou rien » (mettre à jour React implique de toucher toutes les applications), mais c'est bien moins coûteux que de déboguer des dérives de versions.
