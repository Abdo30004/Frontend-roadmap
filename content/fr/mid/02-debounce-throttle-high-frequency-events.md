# Debounce, throttle et garder une UI réactive face à des événements très fréquents

**Niveau :** Mid
**Merged from (original phrasings):**
- Expliquez le debouncing et le throttling avec des exemples concrets.
- Votre UI reçoit des milliers d'événements par seconde. Comment la garder réactive ?

## The concept (short answer)
- **Debounce** : attendre que les événements **s'arrêtent** pendant N ms, puis exécuter une seule fois. Idéal pour la recherche à la frappe, la sauvegarde automatique, la fin d'un resize, la validation de formulaire.
- **Throttle** : exécuter **au plus une fois toutes les N ms** tant que les événements continuent d'arriver. Idéal pour la position de scroll, les vérifications d'infinite scroll, le drag, les pings d'analytics.
- **Regroupement par rAF** : fusionner toutes les mises à jour d'une même frame et les appliquer une seule fois dans `requestAnimationFrame`. Cela s'exécute au rythme du rafraîchissement de l'écran, donc vous ne faites jamais plus de travail DOM que ce qui peut être affiché.
- **Buffer puis flush** : pour les flux (ticks WebSocket, logs), poussez les messages entrants dans un simple tableau (peu coûteux) et transférez-les dans le state via un timer ou rAF. Un seul rendu par flush au lieu d'un rendu par message.
- **Web Workers** : sortez le parsing, le tri et l'agrégation du main thread. Ne renvoyez que le petit résultat.
- Également : virtualisez les longues listes, et utilisez `useDeferredValue`/`startTransition` pour que la saisie urgente reste réactive pendant que le rendu coûteux reste interruptible.

```js
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function throttle(fn, wait) {
  let last = 0, t;
  return (...args) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else {
      clearTimeout(t); // appel final (trailing) pour ne pas perdre la dernière valeur
      t = setTimeout(() => { last = Date.now(); fn(...args); }, remaining);
    }
  };
}
```

## Real-life example: the problem
Un dashboard de trading crypto reçoit environ 2 000 ticks de prix par seconde via un WebSocket. Chaque tick appelle `setPrices`, et le carnet d'ordres se re-render à chaque message. Les utilisateurs signalent que le bouton « Acheter » réagit avec une demi-seconde de retard, que la saisie dans le champ du montant rame et que le ventilateur s'emballe. Le champ de recherche de la même application envoie une requête API par frappe, et les résultats clignotent parce que d'anciennes réponses arrivent en retard.

```jsx
function OrderBook() {
  const [prices, setPrices] = useState({});

  useEffect(() => {
    const ws = new WebSocket('wss://example.com/ticks');
    ws.onmessage = (e) => {
      const tick = JSON.parse(e.data);
      setPrices((p) => ({ ...p, [tick.symbol]: tick.price })); // 2 000 rendus/s
    };
    return () => ws.close();
  }, []);

  return <PriceTable prices={prices} />;
}

function SymbolSearch() {
  const [results, setResults] = useState([]);
  return (
    <input
      onChange={async (e) => {
        const res = await fetch(`/api/symbols?q=${e.target.value}`); // 1 requête par touche
        setResults(await res.json());
      }}
    />
  );
}
```

## How to fix it
Mettez les ticks en buffer et faites un flush une fois par frame d'animation. Appliquez un debounce à la recherche.

```jsx
function OrderBook() {
  const [prices, setPrices] = useState({});

  useEffect(() => {
    const ws = new WebSocket('wss://example.com/ticks');
    let buffer = {};   // dernier prix par symbole, sans passer par React
    let frame = 0;

    const flush = () => {
      frame = 0;
      const batch = buffer;
      buffer = {};
      setPrices((p) => ({ ...p, ...batch })); // ~60 rendus/s maximum
    };

    ws.onmessage = (e) => {
      const tick = JSON.parse(e.data);
      buffer[tick.symbol] = tick.price;          // le tick le plus récent écrase l'ancien
      if (!frame) frame = requestAnimationFrame(flush);
    };

    return () => {
      ws.close();
      cancelAnimationFrame(frame);
    };
  }, []);

  return <PriceTable prices={prices} />;
}

function SymbolSearch() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debounced) return;
    const ctrl = new AbortController();
    fetch(`/api/symbols?q=${encodeURIComponent(debounced)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then(setResults)
      .catch((err) => { if (err.name !== 'AbortError') console.error(err); });
    return () => ctrl.abort(); // les réponses périmées n'écrasent jamais les nouvelles
  }, [debounced]);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```
Pourquoi ça marche : le handler du WebSocket ne fait plus qu'un travail en O(1) par message. React fait au plus un rendu par frame, avec le dernier prix de chaque symbole, ce qui libère le main thread pour les clics et la saisie. La recherche n'envoie qu'une requête quand l'utilisateur fait une pause, et `AbortController` annule les requêtes obsolètes.

Si le parsing JSON ou l'agrégation sont eux-mêmes coûteux (des milliers de messages/s avec de gros payloads), ouvrez le WebSocket dans un **Web Worker**, faites l'agrégation là-bas et envoyez via `postMessage` un snapshot compact toutes les 100ms. Virtualisez aussi le tableau s'il contient des milliers de lignes.

## How to say it in the interview
- « Le debounce attend le silence, le throttle fixe une fréquence maximale. Pour les mises à jour visuelles, je regroupe avec `requestAnimationFrame`, puisque l'écran ne peut de toute façon pas afficher plus d'une frame par rafraîchissement. »
- « Face à un déluge d'événements, je découple la réception du rendu : buffer dans une simple variable, flush vers le state à intervalle régulier, et parsing lourd déplacé dans un worker. »
- Piège : créer la fonction debouncée dans le corps du composant sans `useMemo`/`useRef`. Un nouveau debounce est créé à chaque rendu, donc il ne debounce jamais réellement.
- Compromis : le debounce ajoute de la latence (l'utilisateur attend 300ms). Le throttle peut perdre des valeurs intermédiaires, donc assurez-vous que l'appel final (trailing) s'exécute et que l'état final est correct.
