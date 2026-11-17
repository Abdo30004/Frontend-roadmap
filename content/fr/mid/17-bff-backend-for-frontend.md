# Qu'est-ce qu'un BFF (Backend for Frontend) ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Qu'est-ce qu'un BFF (Backend for Frontend) ?

## The concept (short answer)
- Un **BFF** est une fine couche serveur **maintenue par l'équipe frontend** et conçue pour **un client précis** (application web, application mobile, smart TV). Il se place entre cette interface et les services backend ou microservices génériques.
- Il **agrège et met en forme** les données : un seul appel depuis le navigateur au lieu de 5 à 10 appels vers différents services. Il renvoie exactement les champs dont l'écran a besoin, donc des payloads plus petits, sans over-fetching ni cascades de requêtes (waterfalls) côté client.
- C'est une **frontière de sécurité** : les secrets, les tokens de service et les clés d'API tierces restent sur le serveur. Le navigateur reçoit un cookie de session httpOnly, et le BFF l'échange contre des access tokens (le pattern « token handler »).
- Il **découple** l'interface des évolutions du backend : quand un service renomme un champ ou se scinde en deux, seul le mapping du BFF change.
- Implémentations courantes : Route Handlers ou Server Components/Server Actions de Next.js, un service Node/Express/Fastify, ou une gateway GraphQL.
- Il ne doit pas contenir la logique métier centrale (règles de tarification, permissions). Celle-ci reste dans les services du domaine, sinon le web et le mobile finissent par diverger.

## Real-life example: the problem
L'écran d'accueil d'une application web de livraison de repas a besoin du profil utilisateur, des adresses enregistrées, des restaurants à proximité, des promotions en cours et du statut de la commande en cours. L'application React appelle directement cinq microservices. Sur des téléphones milieu de gamme en 4G, l'écran d'accueil met environ 4 s à s'afficher : l'appel des restaurants attend celui des adresses (un waterfall), les payloads des restaurants incluent les menus complets (900 Ko) alors que l'écran n'affiche que le nom, la note et le délai de livraison, et le service de promotions exige une clé d'API partenaire qui se retrouve dans le bundle JS.

```jsx
// HomeScreen.jsx : le navigateur orchestre 5 services
useEffect(() => {
  (async () => {
    const user = await fetch('https://users.api.example.com/me', { credentials: 'include' }).then(r => r.json());
    const addresses = await fetch(`https://users.api.example.com/${user.id}/addresses`).then(r => r.json());
    const restaurants = await fetch(
      `https://catalog.api.example.com/restaurants?lat=${addresses[0].lat}&lng=${addresses[0].lng}`
    ).then(r => r.json());                                   // 900 Ko, menus complets inclus
    const promos = await fetch('https://partner-promos.example.com/v2/offers', {
      headers: { 'X-Api-Key': import.meta.env.VITE_PROMO_KEY }, // secret exposé dans le bundle
    }).then(r => r.json());
    const order = await fetch(`https://orders.api.example.com/active?user=${user.id}`).then(r => r.json());
    setState({ user, restaurants, promos, order });
  })();
}, []);
```

Problèmes : des allers-retours réseau séquentiels depuis un appareil lent, des payloads surdimensionnés, un secret exposé, du CORS à configurer sur cinq services, et chaque changement côté backend casse l'interface.

## How to fix it
Ajoutez un endpoint BFF taillé pour l'écran d'accueil (ici avec un Route Handler Next.js) :

```js
// app/api/home/route.js : s'exécute sur le serveur, près des services
import { cookies } from 'next/headers';
import { getAccessToken } from '@/server/auth';

export async function GET() {
  const token = await getAccessToken((await cookies()).get('session')?.value);
  if (!token) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const [user, addresses, order] = await Promise.all([
    fetch(`${USERS_URL}/me`, auth).then(r => r.json()),
    fetch(`${USERS_URL}/me/addresses`, auth).then(r => r.json()),
    fetch(`${ORDERS_URL}/me/active`, auth).then(r => r.json()),
  ]);

  const { lat, lng } = addresses[0] ?? {};
  const [restaurants, promos] = await Promise.allSettled([
    fetch(`${CATALOG_URL}/restaurants?lat=${lat}&lng=${lng}&fields=id,name,rating,eta,imageUrl`).then(r => r.json()),
    fetch(`${PROMOS_URL}/v2/offers`, { headers: { 'X-Api-Key': process.env.PROMO_KEY } }).then(r => r.json()),
  ]);

  return Response.json({
    greetingName: user.firstName,
    activeOrder: order ? { id: order.id, status: order.status, eta: order.eta } : null,
    restaurants: restaurants.status === 'fulfilled' ? restaurants.value.slice(0, 20) : [],
    promos: promos.status === 'fulfilled' ? promos.value.map(p => ({ id: p.id, title: p.title })) : [], // dégradation en douceur
  });
}
```

```jsx
// HomeScreen.jsx : une seule requête same-origin
const { data } = useQuery({ queryKey: ['home'], queryFn: () => fetch('/api/home').then(r => r.json()) });
```

Pourquoi ça marche : la répartition des appels se fait de serveur à serveur, sur un réseau interne rapide et en parallèle. Le navigateur effectue une seule requête same-origin (pas de CORS, le cookie est envoyé automatiquement) et reçoit un petit payload adapté à l'écran. La clé partenaire ne quitte jamais le serveur. Si le service de promotions est en panne, l'écran d'accueil s'affiche quand même.

Alternatives : une gateway GraphQL (les clients choisissent eux-mêmes leurs champs, ce qui fonctionne bien quand il y a beaucoup d'écrans différents) ; une API gateway générique gère le routage, le rate limiting et l'authentification, mais ne met pas en forme les données pour chaque client.

## How to say it in the interview
- « Un BFF, c'est un backend par expérience frontend, maintenu par l'équipe UI, qui agrège les services, met en forme les réponses pour l'écran et garde les secrets et les tokens hors du client. »
- « Dans Next.js, le BFF est souvent intégré : les Route Handlers, les Server Components et les Server Actions s'exécutent déjà sur le serveur. »
- Piège / question de suivi : « Ce n'est pas juste un saut réseau de plus ? » Si, mais un aller-retour navigateur-BFF plus des appels internes en parallèle, c'est mieux que plusieurs allers-retours séquentiels depuis un téléphone. Surveillez la latence du BFF lui-même et ajoutez des timeouts.
- Compromis : un service de plus à déployer, superviser et faire monter en charge, et le risque que de la logique métier s'y glisse et soit dupliquée entre les BFF web et mobile.
