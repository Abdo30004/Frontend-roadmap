# Répartir le cache entre navigateur, CDN, service worker et couche API

**Niveau :** Senior
**Merged from (original phrasings):**
- Comment répartiriez-vous le cache entre le navigateur, le CDN, le service worker et la couche API ?

## The concept (short answer)

Chaque couche met en cache quelque chose de différent, et `Cache-Control` est le contrat entre elles :

- **Assets statiques hashés** (`app.3f9a1c.js`, polices, images avec un hash de contenu dans le nom) : `Cache-Control: public, max-age=31536000, immutable`. L'URL change quand le contenu change, donc mettre en cache « pour toujours » dans le navigateur et le CDN est sans risque.
- **Documents HTML / `index.html`** (le point d'entrée qui référence les hashs) : `no-cache` pour le navigateur (stocker mais **revalider** à chaque fois avec un ETag -> `304` peu coûteux). Au niveau du CDN, soit `no-cache` aussi, soit `s-maxage=60, stale-while-revalidate=...` **avec une purge du CDN à chaque déploiement**. Jamais de `max-age` long sur le HTML.
- **Directives propres au CDN :** `s-maxage` ne s'applique qu'aux caches partagés (CDN / proxy) et y remplace `max-age` ; `stale-while-revalidate=N` sert instantanément la copie périmée tout en récupérant une version fraîche en arrière-plan ; `Vary` déclare quels en-têtes de requête modifient la réponse (par exemple `Accept-Encoding`, parfois `Accept-Language`).
- **Réponses d'API :** données propres à l'utilisateur -> `private, no-store` (ou `private, no-cache`) pour qu'aucun CDN ne les stocke jamais ; données publiques et partagées (catalogue produits, taux de change) -> `public, s-maxage=60, stale-while-revalidate=300` en edge.
- **Service worker :** support hors ligne et rechargements instantanés. Cache-first pour les assets hashés, **network-first** pour les navigations / le HTML, network-first ou stale-while-revalidate pour certains appels d'API choisis. C'est un cache programmable qui ignore la sémantique HTTP, sauf si vous l'implémentez - la plupart des bugs du type « l'application reste figée sur une vieille version » se trouvent ici.
- **Cache de requêtes côté client (TanStack Query/SWR/RTK Query) :** en mémoire, par session, pour la déduplication et une UI instantanée ; réglé avec `staleTime`, invalidé par les mutations. Il complète le cache HTTP, il ne le remplace pas.

## Real-life example: the problem

Un cas typique : une application web de réservation de VTC déploie une nouvelle version à 10h00. De 10h00 à 11h00, une partie des utilisateurs voit un écran blanc avec `ChunkLoadError: Loading chunk 482 failed` dans Sentry. D'autres continuent à utiliser la version de la semaine précédente, avec un bug de tarification connu, même après avoir rafraîchi. Causes profondes :

1. `index.html` est mis en cache par le CDN et les navigateurs pendant une heure, donc il référence toujours `chunk-482.a1b2.js`, qui a été supprimé du bucket lors du déploiement.
2. Un service worker sert `index.html` en cache-first et ne se met à jour qu'en arrière-plan - et le nouveau SW reste en état « waiting » jusqu'à ce que tous les onglets soient fermés.

```nginx
# La même politique pour tout
location / {
  root /var/www/app;
  add_header Cache-Control "public, max-age=3600";
  try_files $uri /index.html;
}
```

```js
// sw.js - cache-first pour tout, y compris les navigations
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

```yaml
# étape de déploiement : efface les anciens assets
- run: aws s3 sync ./dist s3://app-bucket --delete
```

## How to fix it

```nginx
# Sortie de build hashée et immuable
location /assets/ {
  root /var/www/app;
  add_header Cache-Control "public, max-age=31536000, immutable";
}

# Point d'entrée HTML : toujours revalider (ETag -> 304 si inchangé)
location / {
  root /var/www/app;
  add_header Cache-Control "no-cache";
  try_files $uri /index.html;
}

# API : les données utilisateur ne doivent jamais se trouver dans un cache partagé
location /api/me/ {
  proxy_pass http://api;
  add_header Cache-Control "private, no-store" always;
}

# API : catalogue public, mis en cache en edge, rafraîchi en arrière-plan
location /api/catalog/ {
  proxy_pass http://api;
  add_header Cache-Control "public, max-age=0, s-maxage=60, stale-while-revalidate=300" always;
}
```

```js
// sw.js - network-first pour les pages, cache-first uniquement pour les assets hashés
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => { const copy = res.clone(); caches.open('pages').then((c) => c.put(request, copy)); return res; })
        .catch(() => caches.match(request).then((r) => r ?? caches.match('/offline.html')))
    );
    return;
  }
  if (new URL(request.url).pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request).then((res) => {
      const copy = res.clone(); caches.open('assets-v1').then((c) => c.put(request, copy)); return res;
    })));
  }
});
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
```

```yaml
# déploiement : d'abord les assets, en gardant les anciens pendant quelques releases, puis le HTML, puis la purge
- run: aws s3 sync ./dist/assets s3://app-bucket/assets          # pas de --delete
- run: aws s3 cp ./dist/index.html s3://app-bucket/index.html --cache-control "no-cache"
- run: aws cloudfront create-invalidation --distribution-id $CF_ID --paths "/index.html" "/"
```

Filet de sécurité dans l'application pour les utilisateurs qui ont encore une ancienne page en mémoire :

```js
window.addEventListener('vite:preloadError', () => window.location.reload()); // Vite ; avec webpack, interceptez ChunkLoadError dans lazy()
```

Pourquoi ça marche : les assets hashés par contenu peuvent être mis en cache pour toujours, car toute modification produit une nouvelle URL ; le seul fichier qui doit être frais est le HTML qui pointe vers eux, et `no-cache` fait que chaque chargement le vérifie à moindre coût avec un `304`. Conserver les anciens assets permet aux pages déjà ouvertes de continuer à charger leurs chunks à la demande. Le service worker ne fige plus une ancienne coquille. Les données utilisateur sont `private`, donc le CDN ne peut jamais servir la réponse d'un utilisateur à un autre ; les données d'API publiques profitent du cache en edge avec revalidation en arrière-plan.

## How to say it in the interview

- « Assets hashés : un an, immutable. HTML : no-cache, revalidation par ETag, purge du CDN au déploiement. API : private/no-store pour les données utilisateur, s-maxage plus stale-while-revalidate pour les données publiques. Service worker : network-first pour les navigations. »
- « Le bug classique après un déploiement, c'est un index.html en cache qui pointe vers des chunks supprimés - corrigez la politique de cache du HTML, gardez les anciens assets pendant quelques releases et rechargez la page en cas d'erreur de chargement de chunk. »
- Piège : `no-cache` ne veut pas dire « ne pas mettre en cache » (c'est `no-store`) ; cela veut dire « stocker mais revalider avant utilisation ». Question de suivi : mettre en cache des pages personnalisées au niveau du CDN - seulement avec une clé de cache / un `Vary` corrects, sinon vous faites fuiter des données entre utilisateurs.
- Compromis : des TTL plus longs signifient moins de requêtes et un coût plus faible, mais une propagation plus lente des changements ; `stale-while-revalidate` donne des réponses rapides au prix de servir des données légèrement anciennes pour une requête.
