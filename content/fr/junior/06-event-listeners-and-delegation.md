# Que sont les event listeners, comment fonctionnent-ils, et qu'est-ce que la délégation d'événements ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Que sont les event listeners ? Comment fonctionnent-ils ?

## The concept (short answer)
- Un **event listener** est une fonction que vous enregistrez sur un élément du DOM avec `element.addEventListener(type, handler, options)`. Quand l'événement se produit (click, input, submit, keydown...), le navigateur appelle le handler avec un **objet événement**.
- Un événement traverse 3 phases : **capture** (de `window` jusqu'à la cible), **cible** (target), puis **bouillonnement** (bubbling, de la cible jusqu'à `window`). Par défaut, les listeners s'exécutent pendant la phase de bubbling ; passez `{ capture: true }` pour qu'ils s'exécutent pendant la capture.
- `event.target` est l'élément réellement cliqué ; `event.currentTarget` est l'élément sur lequel le listener est attaché.
- `event.stopPropagation()` empêche l'événement d'aller plus loin. `event.preventDefault()` annule l'action par défaut du navigateur (envoi d'un formulaire, navigation d'un lien). Ce sont deux choses différentes.
- **Délégation d'événements :** comme les événements remontent (bubbling), vous placez **un seul** listener sur un parent et utilisez `event.target.closest(selector)` pour savoir quel enfant a été cliqué. Cela consomme moins de mémoire et fonctionne pour les enfants ajoutés **plus tard**.
- Retirez les listeners avec `removeEventListener` (même référence de fonction) ou avec le signal d'un `AbortController`. Options utiles : `{ once: true }`, et `{ passive: true }` pour les performances du scroll et du tactile.

```js
button.addEventListener('click', (event) => {
  console.log(event.target, event.currentTarget);
});
```

## Real-life example: the problem
Imaginez la boîte de réception d'une application de messagerie web. Chaque ligne a un bouton « Supprimer ». Les 50 premiers emails fonctionnaient, mais les emails chargés par **scroll infini** (ou les nouveaux messages arrivés en direct) avaient des **boutons Supprimer inactifs**. De plus, la page ralentissait avec le temps : chaque « rafraîchissement » rattachait les listeners, si bien que certains clics envoyaient la requête de suppression **deux fois**.

```js
// BUGUÉ : inbox.js
const list = document.querySelector('#inbox');

function attachDeleteHandlers() {
  document.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      deleteEmail(btn.dataset.id);   // s'exécute une fois par listener attaché
    });
  });
}

renderEmails(list, firstPage);
attachDeleteHandlers();              // seuls les boutons existants reçoivent un listener

async function loadMore() {
  const next = await fetchNextPage();
  appendEmails(list, next);          // nouveaux boutons : pas de listener -> inactifs
}

async function refresh() {
  renderEmails(list, await fetchFirstPage());
  attachDeleteHandlers();            // les boutons qui ont survécu reçoivent un 2e listener
}
```

## How to fix it
Utilisez la délégation d'événements : un seul listener sur le conteneur de la liste gère les clics de toutes les lignes, actuelles et futures.

```js
// CORRIGÉ : inbox.js
const list = document.querySelector('#inbox');

// un seul listener, attaché une seule fois, pour toutes les lignes (maintenant et plus tard)
list.addEventListener('click', (event) => {
  // closest() fonctionne même si l'utilisateur clique sur l'icône <svg> à l'intérieur du bouton
  const deleteBtn = event.target.closest('.delete-btn');
  if (deleteBtn) {
    deleteEmail(deleteBtn.dataset.id);
    return;                          // ne pas ouvrir l'email en plus
  }

  const row = event.target.closest('.email-row');
  if (row) openEmail(row.dataset.id);
});

renderEmails(list, firstPage);

async function loadMore() {
  appendEmails(list, await fetchNextPage()); // les nouvelles lignes fonctionnent automatiquement
}

async function refresh() {
  renderEmails(list, await fetchFirstPage()); // pas de rattachement, pas de doublons
}
```

Pourquoi ça marche : les clics sur n'importe quel `.delete-btn` remontent jusqu'à `#inbox`, où un seul listener les intercepte. Il est attaché **une seule fois**, donc il n'y a pas d'appels en double, et peu importe quand les lignes ont été créées. Vérifier d'abord le bouton de suppression puis sortir tôt avec `return` garantit qu'un clic sur « Supprimer » n'ouvre pas aussi l'email.

Remarque : `stopPropagation()` empêche seulement l'événement d'atteindre les **ancêtres** ; il n'arrête pas les autres listeners du même élément. C'est pourquoi un seul handler combiné avec un `return` anticipé est plus propre que deux listeners séparés sur `#inbox`.

Nettoyer les listeners (par exemple quand un widget est détruit) :

```js
const controller = new AbortController();
window.addEventListener('resize', onResize, { signal: controller.signal });
window.addEventListener('scroll', onScroll, { passive: true, signal: controller.signal });
controller.abort(); // retire les deux
```

En React, vous faites rarement cela à la main : les props `onClick` utilisent déjà la délégation à la racine, et pour les listeners sur `window`/`document`, vous les ajoutez dans un `useEffect` et les retirez dans le cleanup.

## How to say it in the interview
- « Un événement descend pendant la phase de capture, atteint la cible, puis remonte (bubbling). Par défaut, les listeners s'exécutent pendant la phase de bubbling, et c'est ce qui rend la délégation d'événements possible. »
- « Avec la délégation, j'attache un seul listener à un parent et j'utilise `event.target.closest()` pour trouver l'élément. Ça fonctionne pour les éléments ajoutés plus tard et ça évite des centaines de listeners. »
- Piège : `removeEventListener` a besoin de la **même référence de fonction** ; une fonction fléchée écrite en ligne ne peut pas être retirée. Utilisez une fonction nommée ou un `AbortController`.
- Compromis : certains événements ne remontent pas (`focus`, `blur`, `mouseenter`) ; utilisez `focusin`/`focusout` ou `mouseover` pour la délégation. Abuser de `stopPropagation` peut casser les analytics ou une logique « cliquer à l'extérieur pour fermer » placée plus haut.
