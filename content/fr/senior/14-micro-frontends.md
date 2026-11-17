# Concevoir une architecture micro-frontends avec des déploiements indépendants

**Niveau :** Senior
**Merged from (original phrasings):**
- Comment concevez-vous un système micro-frontends avec des déploiements indépendants ?

## The concept (short answer)
- Les micro-frontends découpent l'UI d'un produit en applications détenues par des équipes distinctes, chacune avec son propre repo/pipeline, déployées indépendamment et assemblées au runtime par un **host (shell)**.
- Le mécanisme de runtime le plus courant est **Module Federation** (Webpack 5, Rspack, `@module-federation/vite`) : le host charge le `remoteEntry.js` d'un remote depuis une URL au runtime, ce qui permet de livrer un remote sans rebuilder le host.
- Les **singletons partagés** (React, React DOM, router, design system) doivent être déclarés avec `shared: { singleton: true }` et des plages de versions compatibles, sinon vous vous retrouvez avec deux React et des hooks/contextes cassés.
- Les applications communiquent via un **contrat versionné** et réduit : les props du composant monté, des custom events ou un event bus typé, et l'URL. N'importez jamais le code interne des autres et ne partagez jamais de store global.
- **Isolation du CSS** : CSS Modules / classes préfixées / CSS-in-JS avec des noms scopés, Shadow DOM dans les cas extrêmes ; aucun reset global venant des remotes.
- **Quand NE PAS les utiliser** : une ou deux équipes, une petite application, ou aucun vrai besoin de cadences de release indépendantes. Ils ajoutent un coût au runtime, des bugs de décalage de versions et une charge opérationnelle ; un monorepo bien structuré est généralement préférable.

## Real-life example: the problem
Imaginez un site e-commerce avec un shell, une équipe « Catalogue » et une équipe « Checkout ». Checkout est déployé le mardi ; le mercredi, le bouton « Ajouter au panier » de la page Catalogue ne met plus à jour le badge du panier, et certains utilisateurs voient un écran blanc avec « Invalid hook call ». En plus, la nouvelle feuille de style de Checkout a rendu vert chaque `.button` du site.

```js
// checkout/webpack.config.js - CASSÉ
new ModuleFederationPlugin({
  name: 'checkout',
  filename: 'remoteEntry.js',
  exposes: {
    './CartStore': './src/store/cartStore',   // expose le store Redux interne
    './CheckoutPage': './src/CheckoutPage',
  },
  // pas de "shared" : checkout embarque sa propre copie de React 19
});

// shell/webpack.config.js - CASSÉ
new ModuleFederationPlugin({
  name: 'shell',
  remotes: { checkout: 'checkout@https://cdn.example.com/checkout/remoteEntry.js' },
});
```

```tsx
// catalog/src/AddToCart.tsx - CASSÉ : va fouiller dans le code interne d'une autre équipe
import { cartStore } from 'checkout/CartStore';
cartStore.dispatch({ type: 'cart/ADD', payload: product }); // action renommée mardi
```

```css
/* checkout/src/styles.css - CASSÉ : les sélecteurs globaux fuient dans toutes les applications */
.button { background: green; }
```

Ce qui n'a pas marché : deux copies de React (les hooks cassent à la frontière), un couplage caché aux noms d'actions Redux de Checkout (renommés sans prévenir), une URL `remoteEntry.js` non versionnée qui fait que le host récupère toujours « la dernière version, quelle qu'elle soit », et du CSS global.

## How to fix it
```js
// config partagée utilisée par toutes les applications (packages/mf-shared.js)
const deps = require('./package.json').dependencies;
module.exports.shared = {
  react: { singleton: true, requiredVersion: deps.react },
  'react-dom': { singleton: true, requiredVersion: deps['react-dom'] },
  '@acme/design-system': { singleton: true, requiredVersion: deps['@acme/design-system'] },
};

// checkout/webpack.config.js
new ModuleFederationPlugin({
  name: 'checkout',
  filename: 'remoteEntry.js',
  exposes: { './mount': './src/mount' },   // UN SEUL point d'entrée public
  shared: require('@acme/mf-shared').shared,
});
```

```ts
// @acme/contracts (package npm versionné, détenu conjointement)
export type CartItemAdded = { sku: string; qty: number };
export const CART_ITEM_ADDED = 'cart:item-added/v1';

export function emitCartItemAdded(detail: CartItemAdded) {
  window.dispatchEvent(new CustomEvent(CART_ITEM_ADDED, { detail }));
}
```

```tsx
// catalog/src/AddToCart.tsx - ne communique que via le contrat
import { emitCartItemAdded } from '@acme/contracts';
<button className={styles.addButton} onClick={() => emitCartItemAdded({ sku, qty: 1 })}>
  Add to cart
</button>
```

```ts
// shell : remotes résolus depuis un manifest mis à jour par le pipeline de déploiement
const manifest = await fetch('/mf-manifest.json').then((r) => r.json());
// { "checkout": "https://cdn.example.com/checkout/1.42.0/remoteEntry.js" }
const { mount } = await loadRemote('checkout/mount');   // @module-federation/runtime
```

Pourquoi ça fonctionne :
- Une seule instance de React, donc les hooks et le contexte fonctionnent entre remotes ; `requiredVersion` émet un avertissement au runtime en cas de plages incompatibles.
- Chaque remote expose un seul `mount` (ou un composant) avec des props typées ; les équipes modifient librement leur code interne. Le contrat est versionné (`/v1`), donc les breaking changes sont livrés en `v2` à côté de `v1` pendant une période de transition.
- Un manifest de déploiement avec des URLs immuables et versionnées permet des déploiements indépendants **et** un rollback instantané (il suffit de repointer le manifest vers `1.41.0`).
- Les CSS Modules (`styles.addButton`) produisent des noms de classes scopés ; les styles globaux ne vivent que dans le shell/le design system.
- Chaque remote est enveloppé dans une error boundary + `Suspense` dans le shell, donc un remote qui plante ne dégrade qu'une zone, pas toute la page.

Alternatives : composition côté serveur (edge includes, Next.js Multi-Zones par route), iframes pour une isolation forte (widgets tiers), ou tout simplement un monorepo (Nx/Turborepo) avec des packages séparés.

## How to say it in the interview
- « Les micro-frontends résolvent un problème d'organisation : des équipes indépendantes avec des cycles de release indépendants. Si vous n'avez pas ce problème, un monorepo modulaire coûte moins cher. »
- « Les règles : singletons partagés pour React et le design system, un seul point d'entrée public par remote, des contrats versionnés via events/props/URL, du CSS scopé, et une error boundary autour de chaque remote. »
- Piège en question de relance : « Comment le testez-vous ? » Des tests de contrat sur les types partagés, plus un smoke test end-to-end dans le shell contre les versions déployées des remotes avant de mettre à jour le manifest.
- Compromis : davantage de bundles et des dépendances dupliquées peuvent dégrader les performances ; imposez une liste de dépendances partagées et un budget de bundle par remote.
