# Que sont les Promises, et comment gérer du code asynchrone avec async/await ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Que sont les Promises ? Expliquez « async/await » avec des exemples.
- Comment gérez-vous du code asynchrone avec async/await et les Promises ?

## The concept (short answer)
- Une **Promise** est un objet qui représente une valeur disponible plus tard. Elle a 3 états : **pending** (en attente), **fulfilled** (résolue, avec une valeur) ou **rejected** (rejetée, avec une erreur). Une fois réglée (settled), elle ne change plus jamais.
- Vous lisez le résultat avec `.then(onFulfilled)`, gérez les erreurs avec `.catch(onError)` et faites le nettoyage avec `.finally()`. Chaque `.then` renvoie une nouvelle Promise, ce qui permet d'**enchaîner** les étapes au lieu d'imbriquer des callbacks (le « callback hell »).
- `async/await` est une syntaxe construite au-dessus des Promises. Une fonction `async` **renvoie toujours une Promise**. `await` met en pause cette fonction (pas toute la page) jusqu'à ce que la Promise soit réglée, puis vous donne la valeur ou **lève** l'erreur : vous utilisez donc un `try/catch` classique.
- Les callbacks des Promises s'exécutent comme des **microtâches** (microtasks), après le code synchrone en cours et avant les timers (`setTimeout`).
- Combinateurs : `Promise.all` (exécution en parallèle, échec immédiat si l'une échoue), `Promise.allSettled` (attend toutes les Promises, donne chaque résultat ou erreur), `Promise.race` (la première réglée), `Promise.any` (la première qui réussit).

```js
// Même logique, deux styles
fetch('/api/user')
  .then((res) => res.json())
  .then((user) => console.log(user.name))
  .catch((err) => console.error(err));

async function showUser() {
  try {
    const res = await fetch('/api/user');
    const user = await res.json();
    console.log(user.name);
  } catch (err) {
    console.error(err);
  }
}
```

## Real-life example: the problem
Imaginez la page de paiement d'un site de réservation de voyages. Elle a besoin du profil de l'utilisateur, du panier et des moyens de paiement disponibles avant d'afficher le bouton « Payer ». Les utilisateurs se sont plaints que la page mettait **plus de 3 secondes** à charger. Parfois, elle affichait **« Total: $undefined »**, et quand l'API de paiement renvoyait une erreur 500, le spinner **tournait indéfiniment** sans aucun message.

Trois bugs : les requêtes s'exécutent l'une après l'autre sans raison, un `await` manquant renvoie une Promise au lieu des données, et `fetch` ne rejette pas sur les erreurs HTTP (seulement sur les erreurs réseau), donc rien n'a intercepté la 500.

```js
// BUGUÉ : checkout.js
async function loadCheckout() {
  showSpinner();

  const profile = await fetch('/api/profile').then((r) => r.json());   // 1 s
  const cart = await fetch('/api/cart').then((r) => r.json());         // 1 s, attend profile
  const methods = await fetch('/api/payment-methods').then((r) => r.json()); // 1 s

  const total = calculateTotal(cart); // calculateTotal est async -> total est une Promise
  renderCheckout({ profile, cart, methods, total }); // affiche « $undefined »
  hideSpinner(); // jamais atteint si quelque chose lève une erreur
}

async function calculateTotal(cart) {
  const res = await fetch('/api/pricing', { method: 'POST', body: JSON.stringify(cart) });
  return (await res.json()).total;
}

loadCheckout(); // pas de catch -> « Uncaught (in promise) » et spinner sans fin
```

## How to fix it

```js
// CORRIGÉ : checkout.js
async function getJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`${url} failed with status ${res.status}`); // transforme les erreurs HTTP en rejets
  }
  return res.json();
}

async function calculateTotal(cart) {
  const data = await getJSON('/api/pricing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cart),
  });
  return data.total;
}

async function loadCheckout() {
  showSpinner();
  try {
    // les requêtes indépendantes s'exécutent en parallèle : environ 1 s au lieu de 3 s
    const [profile, cart, methods] = await Promise.all([
      getJSON('/api/profile'),
      getJSON('/api/cart'),
      getJSON('/api/payment-methods'),
    ]);

    const total = await calculateTotal(cart); // dépend de cart, donc on attend
    renderCheckout({ profile, cart, methods, total });
  } catch (err) {
    showError('We could not load your checkout. Please try again.');
    console.error(err);
  } finally {
    hideSpinner(); // s'exécute toujours, en cas de succès comme d'erreur
  }
}

loadCheckout();
```

Pourquoi ça marche :
- `Promise.all` lance les trois requêtes en même temps et attend qu'elles soient toutes terminées. Seul l'appel de calcul du prix, qui a besoin du panier, attend.
- `await calculateTotal(cart)` extrait le nombre de la Promise.
- `getJSON` vérifie `res.ok`, donc une 500 devient une erreur levée, interceptée par le `try/catch` ; `finally` masque toujours le spinner.

Alternative : si l'échec d'une requête ne doit pas casser toute la page (par exemple des recommandations facultatives), utilisez `Promise.allSettled` et traitez chaque résultat séparément.

## How to say it in the interview
- « Une Promise est un espace réservé pour une valeur future, avec trois états : pending, fulfilled, rejected. `async/await` est du sucre syntaxique au-dessus des Promises qui me permet d'écrire du code asynchrone de haut en bas et de gérer les erreurs avec `try/catch`. »
- « J'exécute les requêtes indépendantes en parallèle avec `Promise.all` ; enchaîner des `await` séquentiels est une erreur de performance fréquente. »
- Piège : `fetch` ne rejette qu'en cas d'échec réseau, pas sur une 404 ou une 500. Vérifiez toujours `response.ok`.
- Piège : un `await` dans `array.forEach` n'attend pas. Utilisez `for...of` pour un traitement séquentiel, ou `Promise.all(array.map(...))` pour un traitement en parallèle.
