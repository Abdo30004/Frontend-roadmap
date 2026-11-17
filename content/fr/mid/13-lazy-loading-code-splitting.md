# Comment mettre en place le lazy loading et le code splitting par route en React ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Comment mettez-vous en place le lazy loading et le code splitting par route ?
- Comment mettez-vous en place le lazy loading et le code splitting en React ?
- Comment optimisez-vous le découpage du bundle pour des performances maximales sur les différentes routes ?

## The concept (short answer)
- Le **code splitting** découpe un gros bundle JS en chunks chargés à la demande. Le bundler (Vite/Rollup, webpack, Turbopack) crée un chunk séparé à chaque `import()` dynamique.
- **`React.lazy(() => import('./Page'))`** + **`<Suspense fallback>`** affiche un composant dont le code n'est chargé qu'au moment de son premier rendu. Le module doit avoir un export par défaut (ou il faut mapper un export nommé).
- Le **découpage par route** est le gain le plus important et le plus facile : les utilisateurs ne téléchargent que le code de la page qu'ils ouvrent. Le App Router de Next.js le fait automatiquement par segment de route ; avec React Router, utilisez les routes `lazy`.
- Le **découpage par composant** pour les parties lourdes et pas toujours visibles : éditeurs de texte riche, graphiques, cartes, modales, outils réservés aux admins. Dans Next.js : `next/dynamic` (avec `ssr: false` pour les bibliothèques qui ne fonctionnent que dans le navigateur).
- Le **prefetch** pour masquer le délai : lancez l'`import()` au survol, au focus ou quand le navigateur est inactif. Le `<Link>` de Next.js prefetch les routes visibles en production.
- **Chunks vendor** : placez les bibliothèques stables et partagées (react, react-dom, router) dans un chunk séparé mis en cache longtemps ; évitez un chunk « vendor » géant que chaque route doit télécharger. Analysez avec `rollup-plugin-visualizer` / `@next/bundle-analyzer`.
- Gérez aussi les **erreurs de chargement de chunk** (après un déploiement, les anciens noms de chunks peuvent renvoyer un 404) avec une Error Boundary et un rechargement.

## Real-life example: the problem
Le dashboard d'une banque en ligne est une SPA Vite + React Router. Toutes les pages sont importées en haut d'`App.jsx`, y compris la visionneuse de relevés PDF (pdf.js), la page investissements avec une bibliothèque de graphiques, et le panneau d'administration. Le bundle principal pèse 2.4MB. Sur un téléphone en 4G, l'écran de connexion met 7 secondes à devenir interactif, alors que les utilisateurs n'ont besoin que du formulaire de connexion au départ.

```jsx
// App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Accounts from './pages/Accounts';
import Investments from './pages/Investments';   // importe une grosse bibliothèque de graphiques
import Statements from './pages/Statements';     // importe pdf.js
import AdminPanel from './pages/AdminPanel';     // utilisé par 1 % des utilisateurs

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Accounts />} />
        <Route path="/investments" element={<Investments />} />
        <Route path="/statements" element={<Statements />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </BrowserRouter>
  );
}
```

## How to fix it
```jsx
// App.jsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Login from './pages/Login';            // garder la route d'entrée dans le bundle principal
import { RouteErrorBoundary } from './RouteErrorBoundary';

const loadAccounts = () => import('./pages/Accounts');
const loadInvestments = () => import('./pages/Investments');
const loadStatements = () => import('./pages/Statements');

const Accounts = lazy(loadAccounts);
const Investments = lazy(loadInvestments);
const Statements = lazy(loadStatements);
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

export default function App() {
  return (
    <BrowserRouter>
      <RouteErrorBoundary>                      {/* intercepte les échecs de chargement de chunk */}
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Accounts />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/statements" element={<Statements />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}

// Prefetch au survol/focus : le chunk est généralement prêt avant la fin du clic
export function NavLinkPrefetch({ to, load, children }) {
  return (
    <Link to={to} onMouseEnter={load} onFocus={load}>
      {children}
    </Link>
  );
}
// <NavLinkPrefetch to="/investments" load={loadInvestments}>Investments</NavLinkPrefetch>

// Après la connexion, précharger la page suivante la plus probable quand le navigateur est inactif
window.requestIdleCallback?.(() => loadAccounts()); // absent des anciennes versions de Safari, d'où l'appel optionnel
```

```js
// vite.config.js : chunk vendor stable, cache long, les bibliothèques lourdes restent avec leur route
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) {
            return 'react-vendor'; // change rarement -> reste dans le cache du navigateur d'un déploiement à l'autre
          }
          // pdf.js et la bibliothèque de graphiques ne sont PAS listés : ils se retrouvent uniquement dans les
          // chunks Statements / Investments, donc les autres routes ne les téléchargent jamais
        },
      },
    },
  },
};
```
Pourquoi ça marche : la page de connexion n'embarque plus que le code du login et le chunk React partagé. Chaque route télécharge son propre chunk lors de la première visite, et les bibliothèques lourdes ne se chargent qu'avec la page qui les utilise. Le prefetch au survol ou pendant l'inactivité masque le délai réseau, si bien que la navigation paraît toujours instantanée. Le chunk vendor React séparé garde son hash d'un déploiement à l'autre, donc les utilisateurs qui reviennent ne le téléchargent pas à nouveau. L'error boundary affiche un message « Nouvelle version disponible, rechargez » si un ancien chunk renvoie un 404 après un déploiement.

Avec le App Router de Next.js, les routes sont déjà découpées. Pour les composants lourds, utilisez :
```jsx
'use client'; // ssr: false n'est autorisé que dans un Client Component
import dynamic from 'next/dynamic';

const StatementViewer = dynamic(() => import('./StatementViewer'), {
  ssr: false, loading: () => <PageSkeleton />,
});
```

## How to say it in the interview
- « Je découpe d'abord par route, parce que c'est là que se trouvent les plus gros gains, puis je charge en lazy les composants lourds qui ne sont pas visibles au premier affichage, comme les éditeurs, les graphiques et les modales. »
- « `React.lazy` + `Suspense` crée un chunk par import dynamique. Pour éviter le délai de chargement, je fais du prefetch au survol, au focus ou pendant les temps d'inactivité. »
- Piège : tout charger en lazy, y compris les petits composants ou le contenu au-dessus de la ligne de flottaison. Cela crée des cascades de requêtes et des spinners partout, et peut dégrader le LCP.
- Compromis : davantage de chunks, c'est un chargement initial plus léger et un meilleur cache, mais trop de petits chunks ajoutent un surcoût en requêtes. Utilisez le bundle analyzer pour repérer les gros gains, et gérez les échecs de chargement de chunks après les déploiements.
