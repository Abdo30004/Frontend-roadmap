# Gérer la dette technique dans les grandes bases de code

**Niveau :** Senior
**Merged from (original phrasings):**
- Quelle est votre approche de la gestion de la dette technique dans les grandes bases de code ?

## The concept (short answer)
- La dette technique, c'est le surcoût que paient les changements futurs à cause de raccourcis passés ou de décisions devenues obsolètes. Une partie de la dette est un bon compromis (tenir une deadline) ; le problème, c'est la dette **invisible et non gérée** qui s'accumule.
- **Rendez-la visible** : un **registre de dette** (tickets avec un label `tech-debt` ou un simple tableau) qui consigne quoi, où, pourquoi ça fait mal, le coût du retard et une estimation grossière de la correction. Appuyez-le sur des métriques : temps de build, taux de tests instables, nombre de bugs par module, lead time, hotspots croisant fréquence de modification (churn) et complexité.
- **Reliez-la à l'impact business** : « les changements sur le checkout prennent 3 fois plus de temps et ont causé 4 incidents ce trimestre » est priorisé ; « le code est moche » ne l'est pas.
- **Budgétez-la en continu** : réservez ~15-20 % de chaque sprint à la dette, plus des projets ciblés de temps en temps pour les gros chantiers, au lieu d'attendre un « trimestre de refactoring » qui n'arrive jamais.
- **Règle du boy-scout** : laissez le code que vous touchez un peu meilleur (types, tests, fonctions extraites) dans le cadre du travail normal sur les fonctionnalités.
- **Bloquez la nouvelle dette à l'entrée** : règles de lint, typage strict et checks de CI qui empêchent l'apparition de nouvelles occurrences de mauvais patterns connus pendant que les anciennes sont résorbées (effet cliquet, ou ratcheting).

## Real-life example: the problem
Un cas typique : une application SaaS React vieille de cinq ans. À chaque sprint, les estimations pour la partie « rapports » explosent ; un simple changement de filtre a pris deux semaines et provoqué une régression. La base de code mélange des class components, un store Redux legacy, `moment.js`, des `any` partout et 300 commentaires `// TODO: refactor`. Les développeurs ont réclamé « une réécriture » en rétro pendant un an ; le produit a toujours refusé parce que personne ne savait en expliquer le coût. Pendant ce temps, le nouveau code continuait d'ajouter des imports de `moment` et des `any`, puisque rien ne l'empêchait.

Le seul « suivi » ressemblait à ceci :

```tsx
// reports/ReportFilters.tsx - CASSÉ : la dette est invisible et continue de grossir
// TODO: refactoriser ce bazar
// TODO: supprimer moment
// FIXME: pourquoi a-t-on besoin d'un setTimeout ici ??
import moment from 'moment';

export function ReportFilters(props: any) {
  const range = props.range as any;
  setTimeout(() => props.onChange(moment(range.from).format('YYYY-MM-DD')), 0);
  // ...
}
```

```js
// config eslint - CASSÉ : règles désactivées globalement pour faire passer la CI
rules: {
  '@typescript-eslint/no-explicit-any': 'off',
  'no-restricted-imports': 'off',
}
```

## How to fix it
**1. Un registre de dette avec l'impact business**
```markdown
| ID  | Area     | Problem                                  | Impact (evidence)                                   | Size | Priority |
|-----|----------|------------------------------------------|-----------------------------------------------------|------|----------|
| D-1 | reports  | Untyped filters, legacy Redux + setTimeout | 4 regressions in Q3; filter changes avg 8 days vs 2 | M    | High     |
| D-2 | global   | moment.js (72 KB gz) in main bundle      | +0.4 s LCP on mobile (measured in RUM)              | M    | Medium   |
| D-3 | CI       | 9% flaky E2E tests                       | ~6 dev-hours/week re-running pipelines              | S    | High     |
```
Passé en revue chaque mois avec le product manager ; les éléments en tête sont planifiés dans le budget de 20 %. Les gros chantiers reçoivent un responsable et un plan (jalons, métrique à surveiller).

**2. Bloquer la nouvelle dette, résorber l'ancienne (effet cliquet)**
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
    // fichiers legacy encore tolérés temporairement ; cette liste ne peut que diminuer
    files: ['src/legacy/**', 'src/reports/old/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'warn', 'no-restricted-imports': 'warn' },
  },
];
```
```json
// package.json - effet cliquet : la CI échoue si le nombre d'avertissements AUGMENTE
{ "scripts": { "lint:ratchet": "eslint . --format json -o eslint.json && node scripts/ratchet.mjs" } }
```
Les bulk suppressions d'ESLint (`eslint --suppress-all`, qui écrit `eslint-suppressions.json`) ou Betterer (`@betterer/cli`) font la même chose : enregistrer les violations actuelles et échouer si de nouvelles apparaissent.

**3. Des corrections boy-scout pendant le travail sur les fonctionnalités**
```tsx
// reports/ReportFilters.tsx - après y avoir touché pour une fonctionnalité
import { format } from 'date-fns';

type DateRange = { from: Date; to: Date };
type Props = { range: DateRange; onChange: (from: string) => void };

export function ReportFilters({ range, onChange }: Props) {
  function apply() {
    onChange(format(range.from, 'yyyy-MM-dd'));    // piloté par événement, plus de bricolage avec setTimeout
  }
  // ...
}
```
Plus un test pour la régression corrigée. La description de la PR fait référence à `D-1` et note l'avancement.

Pourquoi ça fonctionne : le registre transforme des plaintes en éléments priorisés, étayés par des preuves, que le produit peut arbitrer ; le budget régulier de 15-20 % continue de payer les intérêts sans arrêter la livraison ; les règles de lint et l'effet cliquet arrêtent l'hémorragie, si bien que la résorption converge vraiment ; les corrections boy-scout se font là où les développeurs travaillent déjà, c'est-à-dire précisément là où la dette coûte le plus cher.

## How to say it in the interview
- « Je traite la dette comme un backlog avec une justification business : visible dans un registre, mesurée avec des indicateurs comme le lead time, le nombre d'incidents et la taille du bundle, et priorisée avec le produit. »
- « Je réserve environ 15-20 % en continu, j'applique la règle du boy-scout dans le travail sur les fonctionnalités, et j'ajoute des règles de lint pour que le nouveau code ne puisse pas ajouter la même dette. »
- Piège en question de relance : « Quand feriez-vous une réécriture ? » Presque jamais en big bang ; préférez un remplacement incrémental (strangler fig) avec des jalons mesurables.
- Compromis : toute dette ne vaut pas la peine d'être remboursée ; un code qui change rarement et casse rarement peut rester moche. Concentrez-vous sur les hotspots où fréquence de changement et douleur se superposent.
