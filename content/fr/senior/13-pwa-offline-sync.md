# Progressive Web Apps, support hors ligne et synchronisation des données

**Niveau :** Senior
**Merged from (original phrasings):**
- Expliquez ce que sont les Progressive Web Apps (PWA) et leurs avantages.
- Comment implémentez-vous les fonctionnalités d'une progressive web app pour améliorer l'expérience utilisateur ?
- Comment gérez-vous le fonctionnement hors ligne et la synchronisation des données ?

## The concept (short answer)
- Une PWA, c'est une application web classique avec trois éléments en plus : HTTPS, un **web app manifest** (nom, icônes, `display: standalone`, pour qu'elle soit installable) et un **service worker** (un script en arrière-plan qui intercepte les requêtes réseau).
- Avantages : installable sans passer par un store, chargements suivants rapides grâce au cache, fonctionne avec un réseau instable ou absent, notifications push, une seule base de code pour toutes les plateformes.
- Le cache se décide ressource par ressource : **cache-first** pour les assets statiques hashés, **stale-while-revalidate** pour des éléments comme les avatars ou les images produit, **network-first** pour les données d'API et le HTML qui doivent être à jour. Workbox fournit ces stratégies sans avoir à écrire les fetch handlers à la main.
- Les *écritures* hors ligne sont la partie difficile. Ne lancez jamais un POST en espérant qu'il passe. Écrivez d'abord la modification dans **IndexedDB (une outbox)**, affichez-la de manière optimiste dans l'UI, puis videz l'outbox quand le réseau revient (Background Sync API là où elle est supportée, événement `online` + retry partout ailleurs).
- La synchronisation exige l'**idempotence** (un ID généré côté client pour qu'un POST rejoué ne crée pas de doublon) et une **stratégie de résolution des conflits** (last-write-wins, numéros de version avec rejet côté serveur, ou fusion champ par champ).

## Real-life example: the problem
Une application de vente terrain est utilisée par des commerciaux qui visitent des magasins. Beaucoup de magasins ont leur réserve au sous-sol, sans réseau. Le commercial saisit une commande, appuie sur « Envoyer », voit un spinner, le spinner se transforme en erreur générique, et il passe à autre chose. La commande est perdue. Pire : quand le signal est intermittent, la requête atteint parfois le serveur mais la réponse se perd, le commercial appuie de nouveau sur « Envoyer », et le magasin reçoit la commande en double.

```tsx
// OrderForm.tsx - CASSÉ : uniquement en ligne, non idempotent
export function OrderForm({ shopId }: { shopId: string }) {
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  async function submit() {
    setStatus('saving');
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, lines }),   // pas d'ID client
      });
      setLines([]);
      setStatus('idle');
    } catch {
      setStatus('error');                           // la commande n'existe que dans le state React
    }
  }
  // ...
}
```

```js
// sw.js - CASSÉ : tout mettre en cache pour toujours
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  );
});
```

Problèmes : la commande n'existe qu'en mémoire, donc fermer l'onglet ou une requête en échec suffit à la perdre. Les retries créent des doublons. Le service worker sert des réponses d'API et un `index.html` périmés pour toujours (les utilisateurs restent bloqués sur une ancienne release), et sans réseau, l'app shell n'est peut-être même pas en cache.

## How to fix it
1. Un service worker Workbox avec une stratégie par route.
2. Une outbox IndexedDB avec des IDs générés côté client.
3. Une boucle de synchronisation déclenchée par Background Sync ou par l'événement `online`.

```js
// sw.js (généré avec workbox-build / vite-plugin-pwa injectManifest)
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

precacheAndRoute(self.__WB_MANIFEST);                     // JS/CSS hashés + app shell

registerRoute(new NavigationRoute(
  new NetworkFirst({ cacheName: 'pages', networkTimeoutSeconds: 3 })
));
registerRoute(({ url }) => url.pathname.startsWith('/api/catalog'),
  new StaleWhileRevalidate({ cacheName: 'catalog' }));    // les produits peuvent être légèrement périmés

self.addEventListener('sync', (event) => {
  if (event.tag === 'flush-outbox') event.waitUntil(flushOutbox());
});
```

```ts
// outbox.ts - partagé entre la page et le service worker
import { openDB } from 'idb';

const db = openDB('sales', 1, {
  upgrade(d) { d.createObjectStore('outbox', { keyPath: 'id' }); },
});

export async function queueOrder(order: Omit<Order, 'id'>) {
  const entry = { ...order, id: crypto.randomUUID(), createdAt: Date.now(), version: 1 };
  await (await db).put('outbox', entry);                  // persisté avant toute autre chose
  const reg = await navigator.serviceWorker.ready;
  if ('sync' in reg) await reg.sync.register('flush-outbox');
  else flushOutbox();                                     // solution de repli pour Safari/Firefox
  return entry;
}

export async function flushOutbox() {
  const all = await (await db).getAll('outbox');
  for (const entry of all) {
    const res = await fetch('/api/orders', {
      method: 'PUT',                                      // upsert idempotent par id
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': entry.id },
      body: JSON.stringify(entry),
    });
    if (res.ok || res.status === 409) {                   // 409 = conflit, géré plus bas
      if (res.status === 409) await saveConflict(entry, await res.json());
      await (await db).delete('outbox', entry.id);
    } else {
      throw new Error('retry later');                     // Background Sync réessaiera
    }
  }
}

if (typeof window !== 'undefined') window.addEventListener('online', () => flushOutbox());
```

Dans le formulaire, `submit()` appelle désormais `queueOrder(...)`, affiche immédiatement la commande dans une liste « En attente de synchronisation (3) » et vide le formulaire. Le commercial voit un badge hors ligne clair au lieu d'une erreur.

Pourquoi ça fonctionne :
- La commande est écrite dans IndexedDB avant tout appel réseau, donc rien n'est perdu si l'onglet se ferme.
- L'`id` généré côté client + `PUT`/`Idempotency-Key` rendent les retries sûrs : le serveur fait un upsert, pas de commande en double.
- Les conflits (par exemple, un utilisateur du back-office a modifié la même commande) reviennent en `409` avec la version serveur ; l'application conserve les deux et demande au commercial, ou applique une règle du type « le serveur l'emporte pour les prix, le client pour les quantités ».
- Le HTML est en network-first avec un timeout : les utilisateurs reçoivent les nouvelles releases quand ils sont en ligne, et l'app shell en cache quand ils ne le sont pas.

Alternatives : un moteur de synchronisation (Replicache, PowerSync, RxDB, CouchDB/PouchDB) ou des CRDT (Yjs, Automerge) quand de nombreux utilisateurs modifient les mêmes données hors ligne.

## How to say it in the interview
- « Une PWA, c'est manifest + service worker + HTTPS ; la vraie valeur, c'est de choisir une stratégie de cache par ressource et de traiter les écritures hors ligne comme une outbox durable dans IndexedDB, et non comme des requêtes en échec. »
- « Chaque écriture hors ligne reçoit un UUID client pour que la synchronisation soit idempotente ; un retry ne peut jamais envoyer deux fois. »
- Piège : Background Sync n'existe que sur Chromium, prévoyez donc toujours une solution de repli sur `online`/au démarrage de l'application. Par ailleurs, iOS peut supprimer le stockage des PWA inutilisées ; appelez `navigator.storage.persist()` et gardez l'outbox petite.
- Compromis : l'offline-first ajoute une vraie complexité (conflits, migrations de schéma IndexedDB, caches périmés). Ne rendez disponibles hors ligne que les parcours dont les utilisateurs ont réellement besoin hors ligne.
