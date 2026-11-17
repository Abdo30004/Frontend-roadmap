# Quelle est la différence entre setTimeout() et setInterval() ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Quelle est la différence entre « setTimeout() » et « setInterval() » ?

## The concept (short answer)
- `setTimeout(fn, delay)` exécute `fn` **une seule fois**, après au moins `delay` ms. Annulez-le avec `clearTimeout(id)`.
- `setInterval(fn, delay)` exécute `fn` **encore et encore**, toutes les `delay` ms, jusqu'à ce que vous appeliez `clearInterval(id)`.
- Les deux renvoient un id, et les deux sont planifiés par le navigateur puis placés dans la **file des tâches (task queue)**. Le callback ne s'exécute que lorsque la pile d'appels (call stack) est vide : le délai est donc un **minimum**, pas une garantie. Un thread principal occupé ou un onglet en arrière-plan (les navigateurs limitent les timers à environ 1 par seconde, voire moins) les retardent.
- `setInterval` n'attend pas que votre traitement soit terminé. Si le callback lance une requête asynchrone qui dure plus longtemps que l'intervalle, les requêtes **s'accumulent et se chevauchent**.
- Un **`setTimeout` récursif** (qui planifie l'exécution suivante à la fin de l'exécution en cours) garantit un écart entre deux exécutions et est plus sûr pour le polling.
- Nettoyez toujours : un intervalle oublié continue de tourner après que l'utilisateur a quitté la page ou que le composant a été démonté.

```js
const id1 = setTimeout(() => console.log('once after 1s'), 1000);
const id2 = setInterval(() => console.log('every 1s'), 1000);
clearInterval(id2); // l'arrêter
```

## Real-life example: the problem
Imaginez un tableau de bord bancaire qui rafraîchit le solde du compte toutes les 5 secondes. Sur un réseau mobile lent, la requête `/api/balance` prend parfois 8 secondes. Les utilisateurs ont vu le solde **faire des allers-retours** entre l'ancienne et la nouvelle valeur, et l'équipe backend a constaté des pics de trafic. De plus, quand les utilisateurs naviguaient vers une autre page de l'application React, l'onglet Network montrait que les requêtes **continuaient** indéfiniment, et après quelques visites de la page, plusieurs intervalles faisaient du polling en même temps.

Deux bugs : `setInterval` lance de nouvelles requêtes alors que les anciennes sont encore en attente (les réponses arrivent dans le désordre), et l'intervalle n'est jamais nettoyé au démontage.

```jsx
// BUGUÉ : BalanceCard.jsx
import { useEffect, useState } from 'react';

export function BalanceCard({ accountId }) {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    setInterval(async () => {
      const res = await fetch(`/api/accounts/${accountId}/balance`);
      const data = await res.json();
      setBalance(data.amount); // une ancienne réponse lente peut écraser une plus récente
    }, 5000);
    // pas de cleanup -> l'intervalle tourne pour toujours, même après le démontage
  }, [accountId]);

  return <p>Balance: {balance ?? 'Loading...'}</p>;
}
```

## How to fix it
Utilisez un `setTimeout` récursif : attendez la fin de la requête, puis planifiez la suivante. Nettoyez le timer dans la fonction de cleanup de l'effet.

```jsx
// CORRIGÉ : BalanceCard.jsx
import { useEffect, useState } from 'react';

export function BalanceCard({ accountId }) {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    let timeoutId;
    let stopped = false;

    async function poll() {
      try {
        const res = await fetch(`/api/accounts/${accountId}/balance`);
        const data = await res.json();
        if (!stopped) setBalance(data.amount);
      } catch (err) {
        console.error('Balance refresh failed', err);
      } finally {
        if (!stopped) {
          timeoutId = setTimeout(poll, 5000); // l'exécution suivante démarre 5 s APRÈS la fin de celle-ci
        }
      }
    }

    poll(); // premier chargement immédiat

    return () => {
      stopped = true;
      clearTimeout(timeoutId); // arrête le polling au démontage ou au changement d'accountId
    };
  }, [accountId]);

  return <p>Balance: {balance ?? 'Loading...'}</p>;
}
```

Pourquoi ça marche : une seule requête est en cours à la fois, donc les réponses ne peuvent jamais arriver dans le désordre. Le flag `stopped` et `clearTimeout` arrêtent tout quand le composant est démonté ou que `accountId` change.

Quand `setInterval` convient : pour un traitement court et synchrone sans risque de chevauchement, comme un compte à rebours (et nettoyez-le quand même dans le cleanup). Pour des données en temps réel, envisagez les WebSockets ou une bibliothèque de données (`refetchInterval` de TanStack Query) plutôt qu'un polling manuel.

## How to say it in the interview
- « `setTimeout` s'exécute une fois après un délai minimum ; `setInterval` se répète jusqu'à ce qu'on l'arrête. Dans les deux cas, le délai n'est qu'un minimum, car les callbacks attendent dans la file des tâches que la pile d'appels soit vide. »
- « Pour faire du polling sur une API, je préfère un `setTimeout` récursif, parce que `setInterval` n'attend pas la fin du traitement asynchrone et que les requêtes peuvent se chevaucher. »
- Piège : oublier `clearInterval`/`clearTimeout` dans le cleanup du `useEffect` React provoque des fuites et des timers en double (très visible avec le StrictMode de React en développement, qui monte les effets deux fois).
- Question de suivi : « Pourquoi mon timer dérive-t-il ? » Chaque tick peut être en retard ; pour une horloge, calculez donc le temps à partir de `Date.now()` au lieu de compter les ticks.
