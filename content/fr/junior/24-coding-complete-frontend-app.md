# Exercice de code : créer une application frontend complète et responsive qui consomme des API

**Niveau :** Junior
**Merged from (original phrasings):**
- Créez une application frontend complète qui consomme des API, gère le state et est entièrement responsive.

## The concept (short answer)
- Les personnes qui corrigent les projets à faire chez soi (take-home) regardent davantage la structure et la robustesse que les fonctionnalités : des dossiers clairs, une **couche de données** séparée, des choix de **state** pertinents, du **routing**, des **états de chargement/d'erreur/vides**, une **mise en page responsive** et un README.
- Stack recommandée pour un take-home de niveau junior : React + Vite (ou Next.js), React Router, **TanStack Query** pour le server state, `useState`/Context pour le petit state d'interface, CSS Modules ou Tailwind, Vitest + RTL pour quelques tests.
- Séparez les deux types de state : le **server state** (les données venant des API : mises en cache, re-récupérées, potentiellement périmées) relève d'une bibliothèque de données ; le **client state** (menu ouvert, thème, filtres) reste local ou dans un Context. Ne mettez pas les données d'API dans Redux à la main, sauf si on vous le demande.
- Tous les appels HTTP passent par **un seul client d'API** (URL de base, headers, gestion des erreurs) et par de petites **fonctions/hooks par fonctionnalité** (`useProducts`). Les composants n'appellent jamais `fetch` directement.
- Chaque écran asynchrone gère les états **chargement, erreur (avec nouvel essai), vide et succès**. CSS mobile-first avec Grid/Flexbox.

Structure recommandée :

```
src/
  api/
    client.js          # wrapper autour de fetch : URL de base, JSON, erreurs, header d'authentification
    products.js        # getProducts, getProduct
  features/
    products/
      useProducts.js   # hooks TanStack Query
      ProductList.jsx
      ProductCard.jsx
      ProductCard.module.css
  components/          # UI générique : Spinner, ErrorMessage, EmptyState, Layout
  pages/               # niveau route : HomePage, ProductPage, NotFound
  App.jsx              # providers + routes
  main.jsx
```

## Real-life example: the problem
Un cas typique : le take-home « catalogue de produits » d'un candidat a été refusé. Notes du correcteur : « URL de l'API codée en dur dans 6 composants, pas d'état de chargement (écran blanc pendant 2 s), l'application plante avec 'Cannot read properties of undefined (reading map)' quand l'API est indisponible, la mise en page casse en dessous de 900px, pas de README. »

```jsx
// ProductsPage.jsx : tout dans un seul composant
export default function ProductsPage() {
  const [products, setProducts] = useState();

  useEffect(() => {
    fetch("https://fakestoreapi.com/products")        // dupliqué dans d'autres fichiers
      .then((r) => r.json())
      .then((data) => setProducts(data));             // pas de gestion d'erreur, pas de res.ok
  }, []);

  return (
    <div style={{ display: "flex", width: "1200px" }}> {/* largeur fixe */}
      {products.map((p) => (                          // plante : products est undefined au départ
        <div style={{ width: "300px" }} onClick={() => (window.location.href = `/p/${p.id}`)}>
          <img src={p.image} width="300" />
          <b>{p.title}</b>
        </div>
      ))}
    </div>
  );
}
```

## How to fix it
1. Un seul client d'API, avec gestion des erreurs :

```js
// src/api/client.js
const BASE_URL = import.meta.env.VITE_API_URL;      // configurable via .env

export async function apiGet(path, { signal } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

// src/api/products.js
export const getProducts = ({ signal }) => apiGet("/products", { signal });
export const getProduct = (id, { signal }) => apiGet(`/products/${id}`, { signal });
```

2. Le server state via des hooks TanStack Query :

```js
// src/features/products/useProducts.js
import { useQuery } from "@tanstack/react-query";
import { getProducts, getProduct } from "../../api/products";

export const useProducts = () =>
  useQuery({ queryKey: ["products"], queryFn: getProducts, staleTime: 60_000 });

export const useProduct = (id) =>
  useQuery({ queryKey: ["product", id], queryFn: ({ signal }) => getProduct(id, { signal }) });
```

3. Structure de l'application, providers et routing :

```jsx
// src/App.jsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="products/:id" element={<ProductPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

4. Un composant qui gère tous les états :

```jsx
// src/features/products/ProductList.jsx
import { Link } from "react-router-dom";
import { useProducts } from "./useProducts";
import styles from "./ProductList.module.css";

export function ProductList() {
  const { data: products, isPending, isError, error, refetch } = useProducts();

  if (isPending) return <Spinner label="Loading products" />;
  if (isError) return <ErrorMessage message={error.message} onRetry={refetch} />;
  if (products.length === 0) return <EmptyState text="No products yet." />;

  return (
    <ul className={styles.grid}>
      {products.map((p) => (
        <li key={p.id}>
          <Link to={`/products/${p.id}`} className={styles.card}>
            <img src={p.image} alt={p.title} loading="lazy" />
            <h3>{p.title}</h3>
            <p>{p.price.toFixed(2)} EUR</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

5. CSS responsive en mobile-first :

```css
/* ProductList.module.css */
.grid {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
  list-style: none;
}
.card { display: flex; flex-direction: column; gap: 0.5rem; }
.card img { width: 100%; aspect-ratio: 1; object-fit: contain; }
```

Pourquoi ça fonctionne :
- La couche d'API est centralisée : changer l'URL de base, ajouter un header d'authentification ou gérer les 401 se fait dans un seul fichier, et les composants restent faciles à tester.
- TanStack Query apporte le cache, la déduplication, les nouvelles tentatives, l'annulation des requêtes et les indicateurs de chargement/d'erreur, ce qui supprime les fetchs écrits à la main dans des `useEffect` et les race conditions.
- Le composant affiche une interface claire pour chaque état : une API lente ou en panne n'aboutit jamais à un écran blanc ni à un plantage.
- `<Link>` offre la navigation côté client et de vrais liens (clavier, clic molette, accessibilité) au lieu d'un `onClick` sur une `div`.
- La grille passe d'une colonne sur téléphone à plusieurs sur desktop, sans media query et sans défilement horizontal.

Pour finir : une error boundary au niveau racine, un fichier `.env.example`, 3 à 5 tests RTL (chargement, erreur + nouvel essai, affichage de la liste), et un README avec l'installation, les choix effectués et « ce que je ferais avec plus de temps ». Alternatives : l'App Router de Next.js avec des Server Components pour la récupération des données, Zustand ou Redux Toolkit si l'énoncé exige un client state partagé complexe.

## How to say it in the interview
- « Je sépare les responsabilités : un client d'API et des hooks par fonctionnalité pour les données, TanStack Query pour le server state, du state local ou un Context pour le state d'interface, des pages au niveau des routes, et de petits composants de présentation. »
- « Chaque vue asynchrone a des états de chargement, d'erreur avec nouvel essai, vide et de succès, et la mise en page est mobile-first avec CSS Grid. »
- Relance : « Pourquoi pas Redux ? » L'essentiel du state d'une application est du server state, qu'une bibliothèque de requêtes gère mieux ; Redux Toolkit a du sens pour un state côté client complexe et partagé.
- Compromis : ajouter des bibliothèques vous fait gagner du temps mais ajoute des dépendances ; dans un take-home, justifiez chaque choix dans le README, car les correcteurs accordent autant de valeur au raisonnement qu'au code.
