# Comment récupérer des données dans Next.js avec getStaticProps et getServerSideProps (et qu'est-ce qui les remplace dans l'App Router) ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Comment récupérez-vous des données dans Next.js avec getStaticProps et getServerSideProps ?

## The concept (short answer)
- **Pages Router (`pages/`) :** la récupération des données se fait via des fonctions exportées depuis le fichier de la page. Elles s'exécutent uniquement sur le serveur et ne sont jamais incluses dans le bundle client.
  - `getStaticProps` : s'exécute au **moment du build** et produit du HTML statique ainsi que du JSON qu'un CDN peut mettre en cache. Ajoutez `revalidate: N` pour l'**ISR**, qui régénère la page en arrière-plan au plus une fois toutes les N secondes. Pour les routes dynamiques, elle s'associe à `getStaticPaths`, avec `fallback: 'blocking'` pour générer les pages qui n'ont pas été pré-construites.
  - `getServerSideProps` : s'exécute à **chaque requête** et a accès à `req`, `res`, aux cookies et à la query. À utiliser pour des données propres à chaque utilisateur ou qui doivent être fraîches. C'est plus lent et cela coûte du temps serveur à chaque appel.
  - Les deux renvoient `{ props }`, `{ notFound: true }` ou `{ redirect }`. Les props doivent être sérialisables en JSON (pas de `Date`, pas de `undefined`).
- **App Router (`app/`) :** plus de fonctions spéciales. Les Server Components sont `async` et appellent directement `fetch` ou la base de données. Le cache se configure par requête ou par route :
  - `fetch(url, { cache: 'force-cache' })` est l'équivalent de getStaticProps.
  - `fetch(url, { next: { revalidate: 60 } })` ou `export const revalidate = 60` est l'équivalent de l'ISR.
  - `fetch(url, { cache: 'no-store' })`, l'utilisation de `cookies()`/`headers()`, ou `export const dynamic = 'force-dynamic'` est l'équivalent de getServerSideProps.
  - `generateStaticParams` remplace `getStaticPaths`. `revalidateTag`/`revalidatePath` gèrent la revalidation à la demande.
- Remarque : depuis Next 15, `fetch` n'est **pas mis en cache par défaut**, vous devez donc activer le cache explicitement.

## Real-life example: the problem
Une boutique d'électronique en ligne a construit sa fiche produit avec `getServerSideProps`. Pendant une campagne Black Friday, chaque consultation de produit sollicitait le serveur d'origine et l'API produits. Le TTFB est passé de 150 ms à 3 s et l'API a commencé à renvoyer des 503. Or les données (titre, caractéristiques, images) ne changent que quelques fois par jour. Seul le stock est vraiment en temps réel. En parallèle, la page « Mes commandes » avait été construite avec `getStaticProps` : après un déploiement, tous les utilisateurs voyaient la même liste de commandes en cache, ce qui constituait une fuite de données personnelles.

```jsx
// pages/products/[slug].jsx : SSR à chaque requête pour des données surtout statiques
export async function getServerSideProps({ params }) {
  const product = await fetch(`${API}/products/${params.slug}`).then(r => r.json());
  return { props: { product } };
}

// pages/account/orders.jsx : page statique pour des données propres à chaque utilisateur (erreur)
export async function getStaticProps() {
  const orders = await fetch(`${API}/orders`, {
    headers: { Authorization: `Bearer ${process.env.SERVICE_TOKEN}` },
  }).then(r => r.json());
  return { props: { orders } }; // figé dans le HTML au build, identique pour tout le monde
}
```

## How to fix it
**Version Pages Router :**
```jsx
// pages/products/[slug].jsx : ISR, servi depuis le CDN, rafraîchi toutes les 5 min
export async function getStaticPaths() {
  const top = await fetch(`${API}/products?top=200`).then(r => r.json());
  return { paths: top.map(p => ({ params: { slug: p.slug } })), fallback: 'blocking' };
}

export async function getStaticProps({ params }) {
  const res = await fetch(`${API}/products/${params.slug}`);
  if (res.status === 404) return { notFound: true, revalidate: 60 };
  const product = await res.json();
  return { props: { product }, revalidate: 300 };
}
// Le stock en temps réel est récupéré côté client (SWR / React Query) dans la page.

// pages/account/orders.jsx : par requête, par utilisateur
export async function getServerSideProps({ req }) {
  const session = req.cookies.session;
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  const orders = await fetch(`${API}/me/orders`, {
    headers: { Cookie: `session=${session}` },
  }).then(r => r.json());
  return { props: { orders } };
}
```

**Équivalent App Router :**
```jsx
// app/products/[slug]/page.jsx
export const revalidate = 300;                     // ISR pour la route

export async function generateStaticParams() {
  const top = await fetch(`${API}/products?top=200`).then(r => r.json());
  return top.map(p => ({ slug: p.slug }));
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = await fetch(`${API}/products/${slug}`, {
    next: { revalidate: 300, tags: [`product:${slug}`] },
  }).then(r => r.json());
  return <ProductView product={product} />;      // stock : client component qui interroge /api/stock à intervalles réguliers
}

// app/account/orders/page.jsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function OrdersPage() {
  const session = (await cookies()).get('session')?.value; // rend la route dynamique
  if (!session) redirect('/login');
  const orders = await fetch(`${API}/me/orders`, {
    headers: { Cookie: `session=${session}` },
    cache: 'no-store',
  }).then(r => r.json());
  return <OrdersList orders={orders} />;
}
```

Quand le CMS met à jour un produit, une route de webhook appelle `revalidateTag('product:' + slug)` pour que la page se mette à jour immédiatement au lieu d'attendre 5 minutes.

Pourquoi ça marche : les données partagées qui changent lentement sont servies depuis le CDN, donc l'origine ne gère qu'une régénération par produit toutes les 5 minutes au lieu d'une par page vue. Les données propres à chaque utilisateur sont toujours rendues à chaque requête avec ses propres identifiants, et jamais figées dans du HTML partagé.

## How to say it in the interview
- « La question que je me pose : ces données sont-elles les mêmes pour tous les utilisateurs, et à quel point doivent-elles être fraîches ? Identiques et tolérantes à un léger retard, c'est du statique ou de l'ISR ; propres à chaque utilisateur ou devant être en temps réel, c'est du SSR ou du no-store. »
- « Dans l'App Router, la même décision se retrouve dans les options de `fetch` et la configuration des segments de route : `force-cache`, `revalidate`, `no-store`, `dynamic`. »
- Piège : appeler votre propre route d'API (`/api/...`) depuis `getServerSideProps` ajoute un aller-retour réseau inutile. Appelez directement la source de données ou une fonction partagée.
- Compromis : l'ISR peut servir des données périmées pour une requête après l'expiration de la fenêtre (stale-while-revalidate). Utilisez la revalidation à la demande quand la fraîcheur compte (prix, stock).
