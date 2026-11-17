# Comment mettre en place le routing en React avec react-router-dom (v6+) ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Comment mettez-vous en place le routing en React avec react-router-dom ?

## The concept (short answer)
- Les applications React sont généralement des **single-page apps (SPA)** : le serveur envoie une seule page HTML, et le router décide quel composant afficher en fonction de l'URL, **sans rechargement complet de la page**. Il s'appuie sur l'API History du navigateur (`pushState`).
- Les éléments principaux en v6+ (mêmes idées en v7, où vous pouvez importer depuis `react-router`) :
  - `createBrowserRouter` + `<RouterProvider>` (le « data router » recommandé), ou `<BrowserRouter>` + `<Routes>` + `<Route>`.
  - `<Link to="/x">` / `<NavLink>` pour la navigation (sans rechargement). Un simple `<a href>` provoque un **rechargement complet** et fait perdre le state.
  - `useNavigate()` pour naviguer depuis le code (par exemple après l'envoi d'un formulaire).
  - `useParams()` pour les segments dynamiques comme `/products/:id` ; `useSearchParams()` pour `?sort=price`.
  - Les **routes imbriquées** + `<Outlet />` pour les layouts partagés (en-tête, barre latérale).
  - Une route attrape-tout `path="*"` pour la 404, et `errorElement` pour les erreurs.
- Pages protégées : vérifiez l'authentification dans une route de layout et renvoyez `<Navigate to="/login" replace />`. C'est uniquement une protection d'**UX** ; l'API doit toujours vérifier les permissions.
- Déploiement : le serveur doit renvoyer `index.html` pour toutes les routes, sinon les liens profonds et le rafraîchissement donnent une **404**.

## Real-life example: the problem
Imaginez une boutique en ligne. Les utilisateurs ont signalé que : cliquer sur un produit dans le menu **rechargeait toute la page** et **vidait le panier** ; la page produit affichait le même produit pour toutes les URL ; les utilisateurs déconnectés pouvaient ouvrir `/account` et voyaient une page cassée ; et l'en-tête disparaissait sur les pages produit.

```jsx
// BUGUÉ : App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<><Header /><Home /></>} />
        <Route path="/products" element={<ProductList />} />          {/* pas d'en-tête */}
        <Route path="/products/id" element={<ProductPage />} />        {/* « id » littéral, pas un paramètre */}
        <Route path="/account" element={<Account />} />               {/* pas de vérification d'authentification */}
      </Routes>
    </BrowserRouter>
  );
}

function Header() {
  return (
    <nav>
      <a href="/products">Products</a>  {/* rechargement complet de la page -> panier en mémoire perdu */}
    </nav>
  );
}

function ProductPage() {
  const product = useProduct(1); // id codé en dur
  return <h1>{product.name}</h1>;
}
```

## How to fix it

```jsx
// CORRIGÉ : main.jsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,          // en-tête + <Outlet />
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Home /> },
      { path: 'products', element: <ProductList /> },
      { path: 'products/:productId', element: <ProductPage /> },
      {
        element: <RequireAuth />,     // route de layout qui protège ses enfants
        children: [{ path: 'account', element: <Account /> }],
      },
      { path: 'login', element: <Login /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
```

```jsx
// CORRIGÉ : layout, liens, paramètres, protection
import { NavLink, Outlet, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';

function RootLayout() {
  return (
    <>
      <nav>
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/products">Products</NavLink> {/* côté client, sans rechargement */}
        <NavLink to="/account">Account</NavLink>
      </nav>
      <main>
        <Outlet /> {/* la route enfant s'affiche ici */}
      </main>
    </>
  );
}

function ProductPage() {
  const { productId } = useParams();       // "42" pour /products/42 (toujours une chaîne)
  const navigate = useNavigate();
  const product = useProduct(productId);

  if (!product) return <p>Loading...</p>;
  return (
    <>
      <h1>{product.name}</h1>
      <button onClick={() => navigate('/products')}>Back to products</button>
    </>
  );
}

function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    // mémorise où l'utilisateur voulait aller ; replace pour que « Retour » ne boucle pas
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
```

Pourquoi ça marche :
- `NavLink`/`Link` modifient l'URL via l'API History, donc React continue de tourner et le state en mémoire (le panier) est conservé. `NavLink` ajoute aussi une classe `active` pour le style.
- `:productId` est un segment dynamique lu avec `useParams`.
- Les routes imbriquées avec `<Outlet />` partagent l'en-tête sur toutes les pages ; la protection est une route de layout, donc toute page ajoutée en dessous est automatiquement protégée.
- `path="*"` gère les URL inconnues ; `errorElement` intercepte les erreurs pendant le rendu des routes.

Alternatives : `<BrowserRouter>` + `<Routes>` avec des `<Route>` imbriquées en JSX fonctionne aussi (mêmes concepts). Avec **Next.js**, on n'utilise pas react-router : le routing est basé sur les fichiers (`app/products/[id]/page.tsx`).

## How to say it in the interview
- « react-router associe les URL à des composants côté client grâce à l'API History, donc la navigation ne recharge pas la page. J'utilise `createBrowserRouter`, des routes imbriquées avec `<Outlet />` pour les layouts, des `:params` avec `useParams`, et une route `*` pour la 404. »
- « Je navigue avec `<Link>`/`<NavLink>`, ou avec `useNavigate` après une action ; un simple `<a href>` provoque un rechargement complet et fait perdre le state. »
- Piège : rafraîchir `/products/42` donne une 404 en production si le serveur n'est pas configuré pour se rabattre sur `index.html`.
- Compromis : les protections de routes côté client ne servent qu'à l'UX ; la vraie sécurité doit se trouver côté serveur. Pour les grosses applications, chargez les routes à la demande (`lazy`) pour garder le premier bundle léger.
