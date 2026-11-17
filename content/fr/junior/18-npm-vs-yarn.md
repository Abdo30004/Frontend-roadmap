# Quelle est la différence entre npm et Yarn ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Expliquez la différence entre npm et yarn.

## The concept (short answer)
- Ce sont tous les deux des **gestionnaires de paquets** (package managers) pour l'écosystème JavaScript : ils lisent `package.json`, téléchargent les paquets depuis le registre npm, les installent dans `node_modules` et exécutent des scripts (`npm run dev` / `yarn dev`).
- **npm** est livré avec Node.js, il est donc toujours disponible. Lockfile : `package-lock.json`.
- **Yarn** a été créé par Facebook en 2016 pour corriger la lenteur de npm et ses installations non déterministes de l'époque. Lockfile : `yarn.lock`. Yarn Classic (v1) est en mode maintenance ; Yarn Berry (v2+) ajoute Plug'n'Play (sans `node_modules`) et les zero-installs.
- Aujourd'hui, l'écart est faible : npm moderne (v7+) a lui aussi des lockfiles, des workspaces et des téléchargements parallèles. Les différences portent surtout sur la syntaxe de la CLI (`npm install x` vs `yarn add x`), le format du lockfile et les fonctionnalités pour les monorepos.
- **pnpm** est une troisième option populaire : un store global adressé par contenu avec des liens physiques (hard links), donc rapide et économe en disque, et un `node_modules` strict qui empêche d'importer des paquets que vous n'avez pas déclarés (« dépendances fantômes »). Lockfile : `pnpm-lock.yaml`.
- Le concept le plus important : le **lockfile** fige la version exacte résolue de chaque dépendance, directe ou transitive. `package.json` indique `"^4.17.0"` (une plage) ; le lockfile indique exactement `4.17.21`. Commitez-le, et utilisez la commande d'installation propre (clean install) en CI.
- Choisissez **un seul** gestionnaire par projet. Corepack + le champ `packageManager` de `package.json` imposent la version.

## Real-life example: the problem
Un cas typique de « ça marche sur ma machine » : un tableau de bord React se build sans problème sur l'ordinateur de chaque développeur, mais le build en CI et le déploiement en production échouent avec `TypeError: Cannot read properties of undefined` dans une bibliothèque de graphiques. Cause racine :
- `package-lock.json` était dans `.gitignore` (« ça provoque des conflits de merge »).
- `package.json` utilise des plages avec caret, donc la CI a résolu une version mineure fraîchement publiée d'une dépendance transitive, qui contenait un bug bloquant. Les développeurs avaient encore l'ancienne version dans leur `node_modules` local.
- Un développeur utilisait Yarn et un autre npm, si bien que `yarn.lock` et `package-lock.json` divergeaient de plus en plus.

```gitignore
# .gitignore
node_modules/
package-lock.json   # <- le bug
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
# Étape de CI
- run: npm install    # résout les plages à neuf à chaque fois, peut mettre à jour les versions
- run: npm run build
```

## How to fix it
```gitignore
# .gitignore : ignorer les paquets installés, JAMAIS le lockfile
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
# Étape de CI
- uses: actions/setup-node@v4
  with: { node-version: 20, cache: npm }
- run: npm ci          # installe EXACTEMENT ce que dit package-lock.json ; échoue s'il n'est pas synchronisé
- run: npm run build
```

Mesures prises :
1. Supprimer le `yarn.lock` égaré, garder un seul gestionnaire, commiter `package-lock.json`.
2. Utiliser `npm ci` en CI (Yarn : `yarn install --frozen-lockfile` / Berry : `yarn install --immutable` ; pnpm : `pnpm install --frozen-lockfile`).
3. Mettre à jour les dépendances de façon délibérée (`npm outdated`, `npm update`, ou des PR Renovate/Dependabot) pour que les nouvelles versions passent par la CI et la review.
4. Conflits de merge dans le lockfile : résolvez d'abord `package.json`, puis lancez `npm install` pour régénérer le lockfile ; ne le modifiez pas à la main.

Pourquoi ça fonctionne : avec le lockfile commité et une commande d'installation propre, chaque ordinateur, chaque exécution de CI et chaque build de production installe exactement le même arbre de dépendances ; « ça marche sur ma machine » veut alors dire que ça marche partout.

Aide-mémoire des commandes :

| Tâche | npm | Yarn | pnpm |
|---|---|---|---|
| Tout installer | `npm install` | `yarn` | `pnpm install` |
| Ajouter une dépendance | `npm install axios` | `yarn add axios` | `pnpm add axios` |
| Ajouter une dépendance de dev | `npm install -D vitest` | `yarn add -D vitest` | `pnpm add -D vitest` |
| Installation en CI | `npm ci` | `yarn install --frozen-lockfile` | `pnpm install --frozen-lockfile` |
| Lancer un script | `npm run build` | `yarn build` | `pnpm build` |
| Exécuter un binaire ponctuellement | `npx create-vite` | `yarn dlx create-vite` | `pnpm dlx create-vite` |

## How to say it in the interview
- « npm et Yarn font le même travail : installer des paquets depuis le registre npm et exécuter des scripts. Yarn s'est d'abord imposé par sa vitesse et ses installations déterministes, mais npm moderne a comblé l'essentiel de l'écart ; pnpm est aujourd'hui populaire pour sa vitesse, son économie d'espace disque et sa gestion stricte des dépendances. »
- Insistez sur le lockfile : commitez-le, utilisez un seul gestionnaire de paquets par dépôt, et lancez `npm ci` (ou l'équivalent frozen-lockfile) en CI.
- Relance : « `^` vs `~` ? » `^1.2.3` autorise les mises à jour mineures et correctives (<2.0.0) ; `~1.2.3` n'autorise que les correctifs (<1.3.0).
- Compromis : la rigueur de pnpm peut casser d'anciens paquets qui comptent sur le hoisting ; Yarn PnP offre des installations rapides, mais certains outils demandent une configuration supplémentaire.
