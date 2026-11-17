# Mettre en place un design system qui passe à l'échelle sur plusieurs équipes

**Niveau :** Senior
**Merged from (original phrasings):**
- Comment mettez-vous en place un design system qui passe à l'échelle sur plusieurs équipes ?

## The concept (short answer)
- Un design system est un **produit**, pas un dossier de composants : design tokens + bibliothèque de composants + documentation + processus de gouvernance, avec une équipe propriétaire et des consommateurs.
- Les **design tokens** (couleurs, espacements, typographie, arrondis, animations) sont la source de vérité unique, stockés sous forme de données (JSON / format W3C tokens) et compilés en variables CSS, constantes TS et formats natifs (Style Dictionary). Les composants consomment des tokens sémantiques (`--color-action-primary`), jamais des valeurs hexadécimales brutes, ce qui fait du theming et du dark mode un simple échange de tokens.
- Livrez-le sous forme de **package versionné** (semver, changesets, changelog) pour que les équipes fassent la mise à jour à leur rythme et que les breaking changes soient explicites.
- **Storybook** sert à la fois de documentation et d'atelier : chaque état de composant sous forme de story, avec tableaux de props, règles d'utilisation et vérifications d'accessibilité (addon-a11y).
- Les **tests de régression visuelle** (Chromatic, captures d'écran Playwright, Loki) sur chaque PR détectent les changements de pixels non voulus sur toutes les stories.
- **Gouvernance** : un modèle de contribution (RFC pour les nouveaux composants, PR « inner source » venant des équipes produit, review par l'équipe core), et des **codemods** (jscodeshift / ts-morph) pour les changements d'API cassants, afin que les mises à jour coûtent peu.

## Real-life example: the problem
Un cas typique : une entreprise avec cinq équipes produit a un dossier `ui` partagé, copié d'un repo à l'autre. Un rebranding change le bleu principal. Trois mois plus tard, le site marketing, le dashboard et le checkout mobile web affichent trois bleus différents, deux hauteurs de bouton et une modale qui n'est pas accessible au clavier dans l'une des applications. Un « petit » changement sur `Button` (renommer `type="primary"` en `variant="primary"`) est mergé directement sur main et casse silencieusement la page de checkout, car les boutons retombent sur un style par défaut non stylé.

```tsx
// Button.tsx - CASSÉ : valeurs en dur, non versionné, rupture d'API silencieuse
export function Button({ variant, children, ...rest }: Props) {
  const bg = variant === 'primary' ? '#1a73e8' : '#eeeeee';   // hex brut, copié partout
  return (
    <button style={{ background: bg, padding: '9px 15px', borderRadius: 3 }} {...rest}>
      {children}
    </button>
  );
}
// les anciens appelants passent toujours type="primary" -> rendu gris, aucune erreur, aucun avertissement
```

```json
// apps/checkout/package.json - CASSÉ : consomme la bibliothèque depuis une branche git
{ "dependencies": { "@acme/ui": "github:acme/ui#main" } }
```

## How to fix it
**1. Les tokens sous forme de données, compilés en variables CSS**
```json
// tokens/color.json (format W3C design tokens)
{
  "color": {
    "brand": { "blue-600": { "$value": "#1a5fd0", "$type": "color" } },
    "action": { "primary": { "$value": "{color.brand.blue-600}", "$type": "color" } }
  }
}
```
```css
/* généré par Style Dictionary -> tokens.css */
:root { --color-action-primary: #1a5fd0; --space-2: 8px; --space-4: 16px; --radius-md: 6px; }
[data-theme='dark'] { --color-action-primary: #6f9cf0; }
```

**2. Les composants utilisent des tokens sémantiques et dépréciment bruyamment les anciennes API**
```tsx
import styles from './Button.module.css';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
  /** @deprecated utilisez `variant`. Supprimé en v4. */
  kind?: 'primary' | 'secondary';
};

export function Button({ variant, kind, className, ...rest }: Props) {
  if (kind && process.env.NODE_ENV !== 'production') {
    console.warn('[ui] Button `kind` is deprecated, use `variant`. Run: npx @acme/ui-codemods button-variant');
  }
  const v = variant ?? kind ?? 'secondary';
  return <button className={`${styles.button} ${styles[v]} ${className ?? ''}`} {...rest} />;
}
```
```css
/* Button.module.css */
.button { padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); }
.primary { background: var(--color-action-primary); color: var(--color-text-on-action); }
```

**3. Un codemod est livré avec la version majeure**
```js
// codemods/button-variant.js (jscodeshift)
export default function transform(file, api) {
  const j = api.jscodeshift;
  return j(file.source)
    .findJSXElements('Button')
    .find(j.JSXAttribute, { name: { name: 'kind' } })
    .forEach((p) => { p.node.name.name = 'variant'; })
    .toSource();
}
```

**4. Pipeline et gouvernance**
```yaml
# .github/workflows/ui.yml (extrait)
- run: pnpm build-storybook
- run: npx chromatic --exit-zero-on-changes=false   # le diff visuel doit être approuvé
- run: pnpm changeset version && pnpm publish -r     # release semver avec changelog
```
Les consommateurs dépendent de `"@acme/ui": "^3.4.0"` ; Renovate ouvre les PR de mise à jour. Les nouveaux composants passent par une courte RFC ; les équipes produit peuvent contribuer, l'équipe core vérifie la cohérence de l'API, l'accessibilité et l'usage des tokens. Une règle ESLint (`no-restricted-syntax` pour les couleurs hexadécimales, ou `stylelint-declaration-strict-value`) bloque les valeurs brutes dans les applications.

Pourquoi ça fonctionne : un seul changement de token re-thème toutes les applications ; semver + changelog + avertissements de dépréciation + codemods transforment les breaking changes en une mise à jour de 10 minutes au lieu d'un bug silencieux ; la régression visuelle détecte les différences de pixels qui échappent aux reviewers.

## How to say it in the interview
- « Les tokens sont la fondation, les composants ne reposent que sur des tokens sémantiques, et la bibliothèque est livrée en package semver avec une documentation Storybook et des tests de régression visuelle. »
- « L'adoption est un problème humain : un modèle de contribution clair, des permanences (office hours), et faire en sorte que la bonne pratique soit la plus simple grâce aux règles de lint et aux codemods. »
- Piège en question de relance : « Comment mesurez-vous l'adoption ? » Analysez les repos pour comparer les imports de `@acme/ui` aux composants locaux et repérer les couleurs en dur ; suivez la dispersion des versions entre applications.
- Compromis : un système trop rigide pousse les équipes à le forker. Prévoyez des échappatoires (`className`, composition/slots, primitives headless comme Radix) tout en gardant les tokens obligatoires.
