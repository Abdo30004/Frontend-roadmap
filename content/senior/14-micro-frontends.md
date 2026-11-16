# Architecting Micro-Frontends with Independent Deployments

**Level:** Senior
**Merged from (original phrasings):**
- How do you architect a micro-frontend system with independent deployments?

## The concept (short answer)
- Micro-frontends split one product UI into apps owned by separate teams, each with its own repo/pipeline, deployed independently, composed at runtime by a **host (shell)**.
- The common runtime mechanism is **Module Federation** (Webpack 5, Rspack, `@module-federation/vite`): the host loads a remote's `remoteEntry.js` from a URL at runtime, so a remote can ship without rebuilding the host.
- **Shared singletons** (React, React DOM, router, design system) must be declared `shared: { singleton: true }` with compatible version ranges, or you get two Reacts and broken hooks/context.
- Apps talk through a small, **versioned contract**: the props of the mounted component, custom events or a typed event bus, and URL. Never import each other's internals or share a global store.
- **CSS isolation**: CSS Modules / prefixed classes / CSS-in-JS with scoped names, Shadow DOM in extreme cases; no global resets from remotes.
- **When NOT to use them**: one or two teams, a small app, or no real need for independent release cadence. They add runtime cost, version-skew bugs and operational overhead; a well-structured monorepo is usually better.

## Real-life example: the problem
Imagine a retail site with a shell, a "Catalog" team and a "Checkout" team. Checkout is deployed on Tuesday; on Wednesday the Catalog page's "Add to cart" button stops updating the cart badge, and some users see an "Invalid hook call" white screen. Also, Checkout's new stylesheet turned every `.button` on the site green.

```js
// checkout/webpack.config.js - BROKEN
new ModuleFederationPlugin({
  name: 'checkout',
  filename: 'remoteEntry.js',
  exposes: {
    './CartStore': './src/store/cartStore',   // exposes internal Redux store
    './CheckoutPage': './src/CheckoutPage',
  },
  // no "shared": checkout bundles its own React 19 copy
});

// shell/webpack.config.js - BROKEN
new ModuleFederationPlugin({
  name: 'shell',
  remotes: { checkout: 'checkout@https://cdn.example.com/checkout/remoteEntry.js' },
});
```

```tsx
// catalog/src/AddToCart.tsx - BROKEN: reaches into another team's internals
import { cartStore } from 'checkout/CartStore';
cartStore.dispatch({ type: 'cart/ADD', payload: product }); // action renamed on Tuesday
```

```css
/* checkout/src/styles.css - BROKEN: global selectors leak into every app */
.button { background: green; }
```

What went wrong: two React copies (hooks break across the boundary), a hidden coupling to Checkout's Redux action names (renamed without notice), an unversioned `remoteEntry.js` URL so the host always pulls "whatever is latest", and global CSS.

## How to fix it
```js
// shared config used by every app (packages/mf-shared.js)
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
  exposes: { './mount': './src/mount' },   // ONE public entry point
  shared: require('@acme/mf-shared').shared,
});
```

```ts
// @acme/contracts (versioned npm package, owned jointly)
export type CartItemAdded = { sku: string; qty: number };
export const CART_ITEM_ADDED = 'cart:item-added/v1';

export function emitCartItemAdded(detail: CartItemAdded) {
  window.dispatchEvent(new CustomEvent(CART_ITEM_ADDED, { detail }));
}
```

```tsx
// catalog/src/AddToCart.tsx - talks through the contract only
import { emitCartItemAdded } from '@acme/contracts';
<button className={styles.addButton} onClick={() => emitCartItemAdded({ sku, qty: 1 })}>
  Add to cart
</button>
```

```ts
// shell: remotes resolved from a manifest the deploy pipeline updates
const manifest = await fetch('/mf-manifest.json').then((r) => r.json());
// { "checkout": "https://cdn.example.com/checkout/1.42.0/remoteEntry.js" }
const { mount } = await loadRemote('checkout/mount');   // @module-federation/runtime
```

Why it works:
- One React instance, so hooks and context work across remotes; `requiredVersion` warns at runtime on incompatible ranges.
- Each remote exposes one `mount` (or a component) with typed props; teams change internals freely. The contract is versioned (`/v1`), so breaking changes ship as `v2` alongside `v1` for a transition period.
- A deploy manifest with immutable, versioned URLs allows independent deploys **and** instant rollback (point the manifest back at `1.41.0`).
- CSS Modules (`styles.addButton`) produce scoped class names; global styles live only in the shell/design system.
- Each remote is wrapped in an error boundary + `Suspense` in the shell, so a crashing remote degrades one region, not the page.

Alternatives: server-side composition (edge includes, Next.js Multi-Zones per route), iframes for strong isolation (third-party widgets), or simply a monorepo (Nx/Turborepo) with separate packages.

## How to say it in the interview
- "Micro-frontends solve an organizational problem: independent teams with independent release cycles. If you do not have that problem, a modular monorepo is cheaper."
- "The rules: shared singletons for React and the design system, one public entry per remote, versioned contracts via events/props/URL, scoped CSS, and an error boundary around every remote."
- Follow-up trap: "How do you test it?" Contract tests on the shared types, plus an end-to-end smoke test in the shell against the deployed remote versions before updating the manifest.
- Trade-off: more bundles and duplicated dependencies can hurt performance; enforce a shared-deps list and a bundle budget per remote.
