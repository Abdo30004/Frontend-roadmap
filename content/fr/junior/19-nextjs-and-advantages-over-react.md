# Qu'est-ce que Next.js et quels sont ses avantages par rapport à React seul ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Qu'est-ce que Next.js ?
- Quels sont les avantages de Next.js par rapport à React.js ?

## The concept (short answer)
- **React** est une bibliothèque d'interface : il affiche des composants. Il ne décide ni du routing, ni de la récupération des données, ni de la stratégie de rendu, ni du bundling, ni du déploiement. Une application React seule (Vite, l'ancien Create React App) est généralement une **SPA rendue côté client** : le serveur envoie un fichier HTML presque vide et un bundle JS, et c'est le navigateur qui construit la page.
- **Next.js** est un **framework React** (créé par Vercel) qui ajoute ces briques manquantes :
  - **Routing basé sur les fichiers** (App Router : `app/products/[id]/page.tsx`), layouts, états de chargement et error boundaries par route.
  - **Plusieurs stratégies de rendu** par route : SSR (rendu à chaque requête), SSG (rendu au build), ISR (statique, revalidé toutes les N secondes), et CSR là où c'est nécessaire.
  - **React Server Components** par défaut : les composants s'exécutent sur le serveur, peuvent récupérer des données ou interroger directement une base de données, et n'envoient aucun JS au navigateur pour eux-mêmes.
  - **Optimisations intégrées** : `next/image` (redimensionnement, lazy loading, formats modernes), `next/font`, code splitting automatique par route, prefetching avec `<Link>`.
  - **Le backend dans le même projet** : Route Handlers (`app/api/.../route.ts`), Server Actions, Middleware.
- Principaux avantages : meilleur **SEO** et meilleurs aperçus sur les réseaux sociaux (du vrai HTML dès la première réponse), **First Contentful Paint / LCP** plus rapides, moins de JS côté client, et moins de configuration.
- Inconvénients : il faut un serveur Node (ou du serverless/edge) pour le SSR, davantage de concepts à apprendre (composants serveur vs client, cache), et une certaine dépendance aux conventions du framework.

## Real-life example: the problem
Un cas typique : une boutique de meubles en ligne a été développée sous forme de SPA React rendue côté client. Le marketing se plaignait que les pages produit n'apparaissaient pas correctement dans les résultats Google et que les liens partagés sur les réseaux sociaux affichaient un aperçu vide avec le titre « React App ». Sur les téléphones milieu de gamme, la page produit affichait un écran blanc avec un spinner pendant environ 3 secondes, parce que le navigateur devait télécharger un bundle de 900 Ko, l'exécuter, puis récupérer le produit, puis faire le rendu.

```jsx
// src/pages/ProductPage.jsx (SPA React avec react-router)
export default function ProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    fetch(`https://api.store.com/products/${id}`)
      .then((r) => r.json())
      .then(setProduct);
  }, [id]);

  if (!product) return <Spinner />;           // c'est ce que les robots d'indexation et les utilisateurs voient en premier
  document.title = product.name;              // trop tard pour les aperçus sur les réseaux sociaux
  return (
    <main>
      <h1>{product.name}</h1>
      <img src={product.imageUrl} />          {/* image originale de 2 Mo */}
      <p>{product.description}</p>
    </main>
  );
}
```

```html
<!-- Ce que le serveur envoie réellement -->
<html><head><title>React App</title></head>
<body><div id="root"></div><script src="/bundle.js"></script></body></html>
```

## How to fix it
Migrez la page vers l'App Router de Next.js sous forme de Server Component, avec ISR et métadonnées.

```tsx
// app/products/[id]/page.tsx  (Server Component par défaut, Next.js 15)
import Image from "next/image";
import { notFound } from "next/navigation";
import AddToCartButton from "./AddToCartButton";

export const revalidate = 300; // ISR : régénérer au plus toutes les 5 minutes

async function getProduct(id: string) {
  const res = await fetch(`https://api.store.com/products/${id}`, {
    next: { revalidate: 300 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load product");
  return res.json();
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);          // le fetch est dédupliqué
  return {
    title: product ? `${product.name} | Nordic Home` : "Product not found",
    description: product?.shortDescription,
    openGraph: { images: product ? [product.imageUrl] : [] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  return (
    <main>
      <h1>{product.name}</h1>
      <Image src={product.imageUrl} alt={product.name} width={800} height={600} priority />
      <p>{product.description}</p>
      <AddToCartButton productId={product.id} />   {/* seul ce composant envoie du JS */}
    </main>
  );
}
```

```tsx
// app/products/[id]/AddToCartButton.tsx
"use client";
import { useState } from "react";

export default function AddToCartButton({ productId }: { productId: string }) {
  const [added, setAdded] = useState(false);
  return (
    <button onClick={() => { /* appeler l'API du panier */ setAdded(true); }}>
      {added ? "Added" : "Add to cart"}
    </button>
  );
}
```

```tsx
// app/products/[id]/loading.tsx : affiché instantanément pendant le streaming de la page
export default function Loading() { return <p>Loading product...</p>; }
```

Pourquoi ça fonctionne :
- La réponse HTML contient déjà le nom du produit, sa description, son image et les balises `<meta>`/Open Graph : les robots d'indexation et les réseaux sociaux voient du vrai contenu.
- L'ISR sert depuis le CDN une page statique mise en cache et la rafraîchit en arrière-plan : c'est aussi rapide qu'un site statique, tout en restant à jour.
- Seul le bouton interactif est un Client Component ; le reste n'envoie aucun JS de composant, ce qui réduit le bundle.
- `next/image` sert une image WebP/AVIF redimensionnée au lieu d'un original de 2 Mo.

Alternatives : Remix / le mode framework de React Router v7, ou Astro pour les sites riches en contenu ; pour un tableau de bord interne accessible après connexion, où le SEO n'a pas d'importance, une SPA Vite reste un très bon choix.

## How to say it in the interview
- « React est une bibliothèque d'interface ; Next.js est un framework React complet qui ajoute le routing, le rendu serveur, les Server Components, la récupération des données, l'optimisation des images et des polices, et des routes d'API. »
- Avantages clés : SEO et aperçus sur les réseaux sociaux, premier chargement plus rapide car le HTML vient du serveur, moins de JS grâce aux Server Components, et choix entre SSR/SSG/ISR route par route.
- Relance : « Server Components vs Client Components ? » Les Server Components ne peuvent pas utiliser de state, d'effets ni d'API du navigateur ; n'ajoutez `"use client"` que sur les composants feuilles interactifs.
- Compromis : plus de complexité (règles de cache, infrastructure serveur) qu'une SPA statique ; cela n'en vaut pas la peine pour un outil purement interne derrière une authentification.
