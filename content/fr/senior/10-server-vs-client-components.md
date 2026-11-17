# Où s'arrête un Server Component et où commence un Client Component

**Niveau :** Senior
**Merged from (original phrasings):**
- Comment décidez-vous où s'arrête un Server Component et où commence un Client Component ?

## The concept (short answer)

- **Par défaut, des Server Components.** Ils s'exécutent uniquement sur le serveur (ou au moment du build), peuvent être `async`, lisent directement la base de données et les secrets, et n'envoient **aucun JS** les concernant au navigateur - seulement leur résultat rendu (le payload RSC).
- **Un Client Component n'est nécessaire que pour l'interactivité ou les API du navigateur :** `useState`/`useEffect`/gestionnaires d'événements, `window`/`localStorage`, librairies réservées au navigateur, context providers.
- **`"use client"` marque une frontière de module, pas un composant isolé :** ce fichier *et tout ce qu'il importe* partent dans le bundle client. Donc **poussez `"use client"` vers les feuilles** (le bouton, le toggle, le graphique), pas vers la page ou le layout.
- **Composition à travers la frontière :** un Client Component ne peut pas `import` un Server Component, mais il peut en recevoir un via `children` ou une autre prop. Le serveur le rend et le client se contente de placer le résultat - par exemple un `<Tabs>` ou un `<Modal>` client qui enveloppe du contenu rendu côté serveur.
- **La frontière est une frontière de sérialisation :** les props passées du serveur au client doivent être sérialisables (chaînes, nombres, objets / tableaux simples, `Date`, `Map`/`Set`, Promises, JSX, Server Actions). Pas de fonctions ordinaires ni d'instances de classes. Et **tout ce que vous passez est visible dans le code source de la page** - les props sont intégrées dans le HTML / le payload RSC.
- **Garde-fous :** `import 'server-only'` dans les modules de données / de secrets fait échouer le build si un fichier client les importe ; passez des DTO (uniquement les champs dont l'UI a besoin), jamais des lignes brutes de la base.

## Real-life example: the problem

La page produit d'une marketplace en ligne sous Next.js App Router. Un développeur avait besoin d'un bouton « Ajouter au panier » avec du state, a obtenu l'erreur « useState only works in Client Components » et a placé `"use client"` en haut de la page. Résultat : le JS de la route a grimpé d'environ 350 KB, car le moteur de rendu markdown et le coloriseur syntaxique utilisés pour la description sont désormais envoyés au navigateur, et l'INP mobile s'est dégradé. Pire, un audit de sécurité a trouvé l'email du vendeur, son IBAN de versement et la marge interne dans le code source de la page : toute la ligne de la base était passée en prop à un composant client.

```tsx
// app/products/[id]/page.tsx
'use client';                                              // toute la page + tous ses imports deviennent du JS client
import { useEffect, useState } from 'react';
import { marked } from 'marked';                           // lourd, utile seulement pour produire le HTML une fois
import hljs from 'highlight.js';

export default function ProductPage({ params }) {
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  useEffect(() => { fetch(`/api/products/${params.id}`).then((r) => r.json()).then(setProduct); }, [params.id]);
  if (!product) return <Spinner />;
  return (
    <>
      <h1>{product.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: marked(product.descriptionMd) }} />
      <input type="number" value={qty} onChange={(e) => setQty(+e.target.value)} />
      <button onClick={() => addToCart(product.id, qty)}>Add to cart</button>
    </>
  );
}

// Ailleurs, la version serveur « corrigée » laisse toujours fuiter des données :
// <SellerCard seller={await db.seller.findUnique({ where: { id } })} />
// SellerCard est 'use client' -> email, iban, marginPct sont sérialisés dans le HTML
```

## How to fix it

Page serveur, feuille client, DTO, et un garde-fou strict sur les modules réservés au serveur.

```tsx
// lib/products.ts
import 'server-only';                                      // erreur de build si importé depuis du code client
export async function getProductView(id: string) {
  const p = await db.product.findUniqueOrThrow({ where: { id }, include: { seller: true } });
  return {                                                 // DTO : uniquement ce dont l'UI a besoin
    id: p.id,
    title: p.title,
    priceCents: p.priceCents,
    descriptionMd: p.descriptionMd,
    seller: { name: p.seller.displayName, rating: p.seller.rating },
  };
}

// app/products/[id]/page.tsx  (Server Component, sans directive)
import { marked } from 'marked';                           // s'exécute uniquement sur le serveur, 0 KB côté client
import { getProductView } from '@/lib/products';
import { AddToCart } from './AddToCart';
import { SellerCard } from './SellerCard';
import { Tabs } from './Tabs';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductView(id);
  return (
    <>
      <h1>{product.title}</h1>
      <AddToCart productId={product.id} />                {/* petit îlot client */}
      <Tabs labels={['Description', 'Seller']}>
        {/* contenu rendu côté serveur, passé à un composant client via children */}
        <div dangerouslySetInnerHTML={{ __html: await marked(product.descriptionMd) }} />
        <SellerCard seller={product.seller} />
      </Tabs>
    </>
  );
}

// app/products/[id]/AddToCart.tsx
'use client';
import { useState, useTransition } from 'react';
import { addToCart } from './actions';                     // Server Action : sérialisable à travers la frontière

export function AddToCart({ productId }: { productId: string }) {
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();
  return (
    <>
      <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
      <button disabled={pending} onClick={() => start(() => addToCart(productId, qty))}>Add to cart</button>
    </>
  );
}

// app/products/[id]/Tabs.tsx
'use client';
import { Children, useState, type ReactNode } from 'react';
export function Tabs({ labels, children }: { labels: string[]; children: ReactNode }) {
  const [i, setI] = useState(0);
  return (
    <div>
      {labels.map((l, idx) => <button key={l} aria-pressed={i === idx} onClick={() => setI(idx)}>{l}</button>)}
      {Children.toArray(children)[i]}
    </div>
  );
}
```

Pourquoi ça marche : seuls `AddToCart` et `Tabs` sont envoyés sous forme de JS ; la librairie markdown et l'accès aux données restent sur le serveur. Les onglets sont interactifs, mais leur contenu est rendu côté serveur puisqu'il arrive via `children`. Le DTO garantit que seuls les champs publics franchissent la frontière de sérialisation, et `server-only` transforme un import accidentel de la couche de données côté client en erreur de build plutôt qu'en fuite. (Assainissez aussi le HTML issu du markdown, par exemple avec DOMPurify côté serveur, si ce sont les vendeurs qui le rédigent.) Les API expérimentales de taint de React peuvent ajouter un garde-fou supplémentaire pour les objets qui ne doivent jamais atteindre le client.

## How to say it in the interview

- « Serveur par défaut ; `use client` uniquement sur la plus petite feuille interactive, car il entraîne tout le graphe d'imports dans le bundle. Les wrappers client reçoivent le contenu serveur via children. »
- « La frontière serveur-client est une frontière de sérialisation - chaque prop se retrouve dans le code source de la page, donc je passe des DTO et je protège les modules de données avec `server-only`. »
- Piège : les variables d'environnement sans `NEXT_PUBLIC_` ne sont pas intégrées aux bundles client, mais les données *lues* grâce à elles et passées en props, si - les fuites passent par les props, pas par les imports. Question de suivi : les context providers sont des composants client, donc enveloppez `{children}` avec eux dans le layout sans convertir le layout.
- Compromis : plus de rendu serveur signifie moins de JS, mais plus de charge serveur et un aller-retour pour chaque interaction qui nécessite une UI serveur fraîche ; les widgets très interactifs (éditeurs, cartes) ont leur place côté client.
