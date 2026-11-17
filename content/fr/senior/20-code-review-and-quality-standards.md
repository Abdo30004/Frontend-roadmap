# Mettre en place un processus de code review et des standards de qualité

**Niveau :** Senior
**Merged from (original phrasings):**
- Comment mettez-vous en place un processus de code review et maintenez-vous des standards de qualité du code ?

## The concept (short answer)
- **Automatisez tout ce qui est mécanique** pour que les humains relisent la conception, pas les points-virgules : Prettier pour le formatage, ESLint (avec `react-hooks`, `jsx-a11y`, règles d'import) et `tsc --noEmit` en CI comme **checks obligatoires**, plus des hooks de pre-commit (lint-staged) pour un retour rapide.
- Les **petites PR** (idéalement moins de ~400 lignes modifiées) sont relues plus vite et mieux ; les grosses fonctionnalités sont livrées par tranches, derrière des flags.
- Un **template de PR** oblige les auteurs à expliquer le pourquoi, à montrer des captures d'écran et à confirmer les tests ; **CODEOWNERS** envoie automatiquement les PR aux bons reviewers.
- Une courte **checklist de review** concentre les reviewers sur ce que les outils ne détectent pas : justesse, cas limites, sécurité, accessibilité, performance, nommage et cohérence avec l'architecture.
- **Protection de branche** : au moins une approbation, checks obligatoires au vert, pas de push direct sur main.
- **Culture** : review dans un délai convenu (par ex. le jour ouvré même), commentaires bienveillants et précis, étiquetés par sévérité (`blocking:`, `nit:`, `question:`), et la critique porte sur le code, pas sur les personnes.

## Real-life example: the problem
Un cas typique : une équipe de 12 personnes sur un dashboard SaaS. Les PR attendent trois jours, puis reçoivent un « LGTM » sans commentaire parce qu'elles font 2 000 lignes. Les fils de review comptent 40 commentaires sur les virgules finales et l'ordre des imports, ce qui déclenche des disputes. Une PR qui retirait une dépendance d'un `useEffect` pour « corriger une boucle » a été approuvée et a provoqué des données périmées sur la page de facturation ; une autre a été mergée avec un bouton `<div onClick>` inaccessible aux utilisateurs du clavier. Main est cassée deux fois par semaine parce que quelqu'un a pushé directement dessus.

Le « processus » se résumait à ceci :

```markdown
<!-- .github/pull_request_template.md - CASSÉ : vide, donc les PR disent « fix stuff » -->
```

```json
// package.json - CASSÉ : le lint existe mais rien ne l'impose
{
  "scripts": {
    "lint": "eslint src",
    "build": "next build"
  }
}
```
Pas de checks en CI, pas de CODEOWNERS, pas de protection de branche, pas d'attentes partagées.

## How to fix it
**1. Automatiser les vérifications de style et de justesse**
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
      'react-hooks/exhaustive-deps': 'error',     // aurait détecté les données de facturation périmées
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

**2. Router et encadrer les PR**
```text
# .github/CODEOWNERS
*                       @acme/web-reviewers
/src/features/billing/  @acme/billing-team
/src/design-system/     @acme/design-system
/.github/workflows/     @acme/platform
```
Protection de branche sur `main` : check `quality` obligatoire, 1 approbation (2 pour `billing/`), review des CODEOWNERS, historique linéaire, pas de push direct.

**3. Un template de PR qui impose le contexte**
```markdown
<!-- .github/pull_request_template.md -->
## What and why
<!-- Mettez le lien vers le ticket. Quel problème cela résout-il ? -->

## How to test
<!-- Étapes, URL de preview, comptes de test -->

## Screenshots / recordings (UI changes)

## Checklist
- [ ] PR is focused and under ~400 lines (or explains why not)
- [ ] Tests added/updated for new behavior and edge cases
- [ ] Keyboard and screen reader checked for new UI
- [ ] No secrets, no PII in logs; user input is validated/escaped
- [ ] Feature flag used if the change is risky or incomplete
```

**4. Règles de review (dans CONTRIBUTING.md)**
- Première réponse sous un jour ouvré ; passez en pair programming ou en call si un fil dépasse ~5 allers-retours.
- Préfixez les commentaires : `blocking:` doit être corrigé, `suggestion:` facultatif, `nit:` préférence de style (signifie en général « ajoutons plutôt une règle de lint »), `question:` je veux comprendre.
- Formulez sous forme d'observations et de questions : « Cet effet lit `accountId` mais ne le déclare pas en dépendance ; la facturation pourrait-elle afficher les données du compte précédent ? » plutôt que « C'est faux. »
- Saluez explicitement les bonnes solutions ; relisez le code, pas l'auteur.

Pourquoi ça fonctionne : les machines imposent le formatage et détectent les patterns de bugs connus, donc le temps de review va à la logique, à l'UX et à la conception ; les petites PR, CODEOWNERS et un délai convenu réduisent l'attente des reviews ; le template et la checklist rendent évidents les tests ou l'accessibilité manquants avant le merge ; les étiquettes de sévérité et une formulation bienveillante évitent que les reviews tournent aux luttes d'ego.

## How to say it in the interview
- « Si un commentaire peut devenir une règle de lint, il doit devenir une règle de lint ; la review humaine sert à la justesse, à la conception, à la sécurité et à l'accessibilité. »
- « J'optimise pour des petites PR et des retours rapides : un délai de review d'un jour, le routage via CODEOWNERS, et des checks de CI obligatoires via la protection de branche. »
- Piège en question de relance : « Comment gérez-vous les désaccords ? » Référez-vous aux standards convenus (ADR, guide de style) ; s'il n'y en a pas, l'auteur tranche sur les points non bloquants et on consigne la décision pour ne pas en rediscuter.
- Compromis : trop d'approbations et de règles obligatoires ralentissent la livraison ; adaptez la rigueur au risque (deux reviewers pour les paiements/l'authentification, un seul pour des changements de texte).
