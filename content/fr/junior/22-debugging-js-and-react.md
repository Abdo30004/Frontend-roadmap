# Comment déboguer efficacement des applications JavaScript et React ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Comment déboguez-vous efficacement des applications JavaScript et React ?

## The concept (short answer)
- Déboguer est une démarche, pas une série de `console.log` au hasard : **reproduire** le bug de façon fiable, **isoler** l'endroit où il se produit, formuler une **hypothèse**, la **vérifier** avec des outils, corriger, puis ajouter un test pour qu'il ne revienne pas.
- Les **DevTools du navigateur** sont la boîte à outils principale :
  - **Console** : erreurs et stack traces, `console.table`, `console.trace`, live expressions.
  - **Sources** : breakpoints, breakpoints conditionnels, logpoints, instruction `debugger;`, exécution pas à pas (step over/into), variables surveillées (watch), pile d'appels (call stack). Les source maps font correspondre le code minifié à vos fichiers d'origine.
  - **Network** : codes de statut, contenu des requêtes, corps des réponses, durées, limitation du débit (« Slow 4G »), « Disable cache ».
  - **Elements/Application** : DOM, CSS calculé, localStorage, cookies ; **Performance** pour les rendus lents.
- **React DevTools** : l'onglet Components pour inspecter les props, le state et les hooks de n'importe quel composant ; le Profiler pour voir quels composants font un re-render et pourquoi (« Highlight updates when components render »).
- Aides propres à React : StrictMode (exécute les effets deux fois en développement pour révéler les cleanups manquants), la règle eslint `react-hooks/exhaustive-deps`, les error boundaries, et des messages d'erreur lisibles dans les builds de développement.
- En production : un outil de suivi des erreurs (Sentry, etc.) avec les source maps envoyées, plus `git bisect` pour trouver le commit qui a introduit une régression.

## Real-life example: the problem
Un cas typique : dans un tableau de bord de support client, quand un agent passe rapidement du ticket n° 101 au ticket n° 102, le panneau affiche parfois les messages du ticket 101 sous l'en-tête du 102. Des agents ont répondu au mauvais client. Un développeur junior a ajouté des `console.log` partout, a constaté que « le bon ID est bien transmis », et n'a pas réussi à reproduire le bug sur le réseau rapide du bureau.

```jsx
function TicketPanel({ ticketId }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    console.log("loading", ticketId);
    fetch(`/api/tickets/${ticketId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        console.log("got data");
        setMessages(data);       // c'est la réponse arrivée en DERNIER qui l'emporte, quelle qu'elle soit
      });
  }, [ticketId]);

  return (
    <section>
      <h2>Ticket #{ticketId}</h2>
      {messages.map((m) => <Message key={m.id} {...m} />)}
    </section>
  );
}
```

## How to fix it
Les étapes de débogage qui mènent à la cause :
1. **Reproduire** : onglet Network des DevTools -> limiter le débit à « Slow 4G », cliquer sur le 101 puis rapidement sur le 102. Désormais, le bug se produit à chaque fois.
2. **Observer** : l'onglet Network montre deux requêtes en cours ; la requête du 101 se termine après celle du 102.
3. **Vérifier** : placer un logpoint (clic droit sur le numéro de ligne -> « Add logpoint ») sur `setMessages` avec `ticketId, data[0]?.ticketId` ; il affiche `102, 101`. React DevTools montre `ticketId: 102` mais des `messages` qui appartiennent au 101.
4. **Hypothèse confirmée** : une race condition ; l'effet n'annule jamais la requête périmée.

La correction : annuler la requête précédente dans le cleanup de l'effet.

```jsx
function TicketPanel({ ticketId }) {
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(`/api/tickets/${ticketId}/messages`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setMessages)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err);  // ignorer notre propre annulation
      });

    return () => controller.abort();  // s'exécute quand ticketId change ou au démontage
  }, [ticketId]);

  if (error) return <p role="alert">Could not load messages.</p>;
  return (
    <section>
      <h2>Ticket #{ticketId}</h2>
      {messages.map((m) => <Message key={m.id} {...m} />)}
    </section>
  );
}
```

Pourquoi ça fonctionne : quand `ticketId` change, React exécute d'abord le cleanup de l'effet précédent, ce qui annule l'ancienne requête ; une réponse tardive pour le 101 ne peut donc plus jamais appeler `setMessages`. Notez aussi que le code d'origine ne vérifiait jamais `res.ok` : une erreur 500 aurait fait planter le `.map` sur un objet d'erreur ; c'est corrigé également.

Verrouillez ensuite la correction avec un test de non-régression (RTL + un fetch mocké et retardé) pour qu'elle tienne dans le temps.

Alternatives : une bibliothèque de données comme TanStack Query ou SWR indexe le cache par ID de ticket et gère pour vous les race conditions, les nouvelles tentatives et le cache ; un simple flag `let ignore = false` dans le cleanup de l'effet fonctionne aussi si vous ne pouvez pas annuler la requête.

Autres outils utiles à mentionner :

```js
debugger;                          // met l'exécution en pause ici quand les DevTools sont ouverts
console.table(rows);               // affiche un tableau d'objets sous forme de table
console.trace("who called me?");   // affiche la pile d'appels
// Expression de breakpoint conditionnel dans Sources : order.total < 0
```

## How to say it in the interview
- « Je commence par reproduire le bug de façon fiable, puis je cerne le problème avec les DevTools : breakpoints et pile d'appels dans Sources, onglet Network pour les problèmes d'API, et React DevTools pour inspecter les props, le state et les re-renders. Après la correction, j'ajoute un test. »
- Racontez une histoire concrète comme la race condition ci-dessus : limiter le débit réseau pour reproduire, puis corriger avec un AbortController dans le cleanup de l'effet.
- Relance : « Comment déboguez-vous en production ? » Suivi des erreurs avec source maps envoyées, logs avec contexte (utilisateur, route, version), feature flags, et `git bisect` pour les régressions.
- Compromis : `console.log` est rapide pour les cas simples, mais les breakpoints permettent de tout inspecter d'un coup sans modifier ni redéployer le code ; supprimez les logs oubliés avant le merge (règle de lint `no-console`).
