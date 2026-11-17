# Enquêter sur l'explosion de la taille d'un bundle

**Niveau :** Senior
**Merged from (original phrasings):**
- Votre bundle JavaScript est passé de 500 KB à 5 MB. Par où commencez-vous ?
- La taille de votre bundle a doublé et les Core Web Vitals se sont dégradés. Par où commencez-vous ?

## The concept (short answer)

- **Mesurez avant de deviner :** faites un build avec un bundle analyzer (`@next/bundle-analyzer`, `webpack-bundle-analyzer`, `rollup-plugin-visualizer` pour Vite, `source-map-explorer`) et examinez la treemap du chunk **initial** de chaque route. Comparez avec le dernier build sain (`git bisect` sur la taille du bundle si besoin).
- **Les suspects habituels, par ordre de fréquence :**
  1. **Imports de librairies entières :** `moment` (+ toutes les locales), `import _ from 'lodash'` (CommonJS, pas tree-shakeable), packs d'icônes, `aws-sdk` v2.
  2. **Barrel files** (`index.ts` qui réexporte tout) qui embarquent des dossiers entiers, surtout si un module a des effets de bord, ce qui neutralise le tree-shaking.
  3. **Composants lourds chargés d'emblée :** librairies de graphiques, éditeurs de texte riche, visionneuses PDF, cartes utilisées dans une seule modale ou une seule route.
  4. **Dépendances dupliquées :** deux versions de la même librairie à cause d'incompatibilités semver (`npm ls <pkg>`, l'analyzer l'affiche deux fois).
  5. **Code serveur qui fuit vers le client :** un `"use client"` placé trop haut dans l'arbre Next.js, ou un utilitaire partagé qui importe un gros SDK.
- **Pourquoi cela pénalise les Web Vitals :** le JS est l'octet le plus coûteux - téléchargement, puis parsing / compilation / exécution sur le main thread. Les gros bundles retardent l'hydratation (INP, interactivité lente) et souvent le LCP quand l'élément principal dépend du JS.
- **Prévenir les régressions :** un budget de taille en CI (`size-limit`, bundlewatch) qui fait échouer la PR et commente le diff.

## Real-life example: the problem

Un tableau de bord analytique SaaS. En deux trimestres, le bundle principal est passé de 500 KB à 5 MB (1,4 MB gzippé). Les données terrain montrent que l'INP mobile est passé de « bon » à 450ms et que le LCP s'est dégradé de 2s sur la page de connexion - qui n'affiche pourtant qu'un formulaire. La treemap de l'analyzer révèle moment avec 160 locales, tout lodash en double (lodash + lodash-es), le build complet d'`echarts` et un éditeur Monaco dans le chunk d'entrée.

```js
// utils/date.js
import moment from 'moment';                       // ~290 KB avec les locales
export const fmt = (d) => moment(d).format('DD MMM YYYY');

// utils/array.js
import _ from 'lodash';                            // tout lodash en CJS (~70 KB minifié)
export const uniqBy = (arr, k) => _.uniqBy(arr, k);

// components/index.ts  (barrel)
export * from './Button';
export * from './Input';
export * from './RevenueChart';                    // importe 'echarts' (build complet)
export * from './SqlEditor';                       // importe 'monaco-editor'

// app/login/page.tsx
import { Button, Input } from '@/components';     // la page de connexion dépend maintenant d'echarts + monaco
```

```json
{
  "dependencies": { "date-fns": "^2.30.0", "some-ui-kit": "^4.1.0" }
}
```

(`some-ui-kit` dépend de `date-fns@^3`, donc les deux versions sont livrées.)

## How to fix it

1. Trouvez la cause : `ANALYZE=true next build` (ou `npx vite-bundle-visualizer`) et `npm ls date-fns lodash`.
2. Remplacez et ciblez les imports :

```js
// utils/date.js - Intl natif, zéro KB
const fmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
export const formatDate = (d) => fmt.format(new Date(d));

// utils/array.js - ESM, tree-shakeable, une seule fonction
import uniqBy from 'lodash-es/uniqBy';
export { uniqBy };
```

3. Importez directement plutôt que via le barrel (ou laissez le framework réécrire les imports), et chargez à la demande les widgets lourds :

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
// next.config.js - réécrit les imports de barrel en chemins directs au moment du build
module.exports = {
  experimental: { optimizePackageImports: ['@/components', 'lucide-react'] },
};
```

```jsonc
// package.json du package interne de composants : indique au bundler que les modules inutilisés peuvent être supprimés
{ "sideEffects": ["*.css"] }
```

4. Dédupliquez : mettez à jour notre propre `date-fns` vers la même version majeure que le kit UI (ou utilisez `overrides`/`resolutions`), puis lancez `npm dedupe`.

5. Verrouillez le tout avec un budget en CI :

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
- run: npx size-limit          # fait échouer la PR quand un budget est dépassé
```

Pourquoi ça marche : l'analyzer transforme les suppositions en une liste classée ; `Intl` natif et les imports ESM par méthode éliminent le poids mort ; les imports directs et `sideEffects` permettent au tree-shaking de fonctionner ; `dynamic()` déplace l'éditeur et les graphiques dans des chunks chargés uniquement quand l'utilisateur ouvre ces vues ; le budget rend la prochaine régression visible dans la PR qui la provoque, et non deux trimestres plus tard.

## How to say it in the interview

- « Je ne devine jamais : d'abord l'analyzer, j'examine le chunk initial de la pire route et je compare avec le dernier build sain. Ensuite, je m'attaque aux trois plus gros coupables. »
- « Les coupables habituels sont les imports de librairies entières, les barrel files qui neutralisent le tree-shaking, les composants lourds chargés d'emblée et les versions dupliquées ; les solutions sont des imports plus ciblés, le code splitting par route et par interaction, la déduplication et un budget de taille en CI. »
- Piège : la taille gzippée n'est pas le vrai coût - un bundle de 400 KB gzippé peut représenter 1,5 MB de JS à parser et exécuter sur un téléphone lent. Mesurez aussi le temps d'exécution.
- Compromis : un découpage excessif crée beaucoup de petites requêtes et des spinners lors des interactions ; découpez au niveau des routes et des éléments « lourds et rarement utilisés », et préchargez les chunks dont l'utilisateur aura probablement besoin ensuite.
