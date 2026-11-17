# Quelle est la différence entre REST et GraphQL ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Expliquez la différence entre les API REST et GraphQL.

## The concept (short answer)
- **REST** expose de nombreuses **URL de ressources** (`/users/42`, `/users/42/orders`) et utilise les verbes HTTP (GET, POST, PUT/PATCH, DELETE) et les codes de statut. C'est **le serveur qui décide de la forme** de chaque réponse.
- **GraphQL** expose **un seul endpoint** (généralement `POST /graphql`) avec un **schéma** typé. **Le client envoie une requête qui décrit exactement les champs dont il a besoin**, éventuellement sur plusieurs types liés, et reçoit une réponse qui a exactement cette forme.
- Les problèmes de REST que GraphQL résout : l'**over-fetching** (recevoir 40 champs quand vous en utilisez 3) et l'**under-fetching** / les allers-retours multiples (récupérer l'utilisateur, puis ses commandes, puis chaque produit).
- Les points forts de REST : simple, profite gratuitement du cache HTTP (CDN, navigateur, ETag) puisque chaque GET a sa propre URL, facile à sécuriser et à limiter (rate limiting) par endpoint, excellent outillage partout.
- Ce que coûte GraphQL : le cache nécessite une bibliothèque cliente (Apollo, urql, Relay) avec un cache normalisé ; les erreurs reviennent généralement avec un HTTP 200 et un tableau `errors` ; les requêtes très imbriquées peuvent coûter cher côté serveur (requêtes N+1, besoin de DataLoader et de limites de profondeur/coût des requêtes).
- Aucun des deux n'est « meilleur » : REST convient au CRUD simple et aux API publiques ; GraphQL convient aux données complexes et liées, consommées par plusieurs clients (web, mobile) aux besoins différents.

## Real-life example: the problem
Un cas typique : l'écran « Mes commandes » d'une application mobile e-commerce mettait 4 à 5 secondes à charger en 3G. Il faisait une requête pour l'utilisateur, une pour la liste des commandes, puis une requête **par commande** pour obtenir le nom et la miniature des produits (une cascade classique / un N+1 côté client). Chaque réponse produit pesait 30 Ko de JSON (description complète, caractéristiques, avis), alors que l'écran n'affichait qu'un nom et une miniature.

```js
// REST, version naïve : 2 + N requêtes séquentielles, des données en grande partie inutilisées
async function loadOrdersScreen(userId) {
  const user = await fetch(`/api/users/${userId}`).then((r) => r.json());
  const orders = await fetch(`/api/users/${userId}/orders`).then((r) => r.json());

  for (const order of orders) {
    // séquentiel : 20 commandes = 20 allers-retours supplémentaires
    const product = await fetch(`/api/products/${order.productId}`).then((r) => r.json());
    order.productName = product.name;          // 30 Ko récupérés, 2 champs utilisés
    order.thumbnail = product.images[0].url;
  }
  return { userName: user.firstName, orders };
}
```

## How to fix it
Option A : GraphQL, un seul aller-retour, exactement les champs nécessaires.

```js
const ORDERS_SCREEN = /* GraphQL */ `
  query OrdersScreen($userId: ID!) {
    user(id: $userId) {
      firstName
      orders(last: 20) {
        id
        status
        total
        product { name thumbnailUrl }
      }
    }
  }
`;

async function loadOrdersScreen(userId) {
  const res = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: ORDERS_SCREEN, variables: { userId } }),
  });
  const { data, errors } = await res.json();
  if (errors?.length) throw new Error(errors[0].message); // le statut HTTP reste 200 !
  return data.user;
}
```

Côté serveur, chaque resolver charge son champ ; `product` utilise DataLoader, si bien que 20 commandes déclenchent une seule requête groupée en base de données, et non 20.

Option B : rester en REST, mais concevoir l'API en fonction de l'écran.

```js
// 1) Paralléliser au lieu d'enchaîner des await séquentiels
const [user, orders] = await Promise.all([
  fetch(`/api/users/${userId}`).then((r) => r.json()),
  fetch(`/api/users/${userId}/orders?expand=product&fields=id,status,total,product.name,product.thumbnailUrl`)
    .then((r) => r.json()),
]);
// 2) ou ajouter un endpoint BFF (« backend for frontend ») : GET /api/screens/orders
```

Pourquoi ça fonctionne :
- GraphQL permet au client de demander des données imbriquées et liées en une seule requête : la latence passe de 2 + N allers-retours à 1, et la charge utile passe de plusieurs centaines de Ko à quelques Ko.
- La correction REST utilise `Promise.all`, l'`expand` / les sparse fieldsets côté serveur, ou un BFF, pour obtenir le même bénéfice tout en conservant le cache HTTP.

Comparaison rapide :

| | REST | GraphQL |
|---|---|---|
| Endpoints | Nombreux, un par ressource | Un seul |
| Forme de la réponse | Fixée par le serveur | Choisie par le client |
| Cache | HTTP/CDN nativement | Cache client (Apollo/urql), persisted queries pour le CDN |
| Erreurs | Codes de statut HTTP | Généralement 200 + tableau `errors` |
| Typage | OpenAPI (optionnel) | Schéma intégré, codegen pour les types TS |
| Versionnage | `/v1`, `/v2` | Évolution du schéma, champs `@deprecated` |

## How to say it in the interview
- « REST est orienté ressources, avec de nombreux endpoints et des réponses définies par le serveur ; GraphQL, c'est un seul endpoint avec un schéma typé où le client demande exactement les champs dont il a besoin, ce qui supprime l'over-fetching et les allers-retours multiples. »
- Restez nuancé : REST l'emporte sur la simplicité et le cache HTTP ; GraphQL l'emporte quand les écrans ont besoin de données liées provenant de nombreuses ressources et quand plusieurs clients ont besoin de formes différentes.
- Piège fréquent : « GraphQL est plus rapide. » Pas automatiquement : une mauvaise configuration des resolvers provoque des requêtes N+1 en base de données, il faut donc DataLoader et des limites de coût des requêtes.
- Relance : la gestion des erreurs. Vérifiez le tableau `errors`, pas seulement `res.ok`, car GraphQL renvoie souvent un 200 avec des données partielles.
