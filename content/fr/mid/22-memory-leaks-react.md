# Qu'est-ce qui provoque des fuites mémoire dans React, et comment les déboguer ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Qu'est-ce qui provoque des fuites mémoire dans React, et comment les déboguer ?

## The concept (short answer)
- Une fuite mémoire, c'est de la mémoire **encore atteignable** (le garbage collector ne peut donc pas la libérer) mais dont on n'a plus besoin. Dans les SPA, les fuites s'accumulent parce que la page n'est jamais rechargée : la mémoire augmente à chaque navigation, jusqu'à ce que l'onglet devienne lent ou plante.
- **Causes fréquentes dans React :**
  - Des effets qui s'abonnent sans cleanup : `window.addEventListener`, `setInterval`, WebSocket/EventSource, `ResizeObserver`/`IntersectionObserver`, abonnements à un store, widgets tiers (cartes, graphiques) jamais détruits avec `.destroy()`.
  - Des **closures** maintenues en vie par ces listeners : le callback référence le state, les props ou de grosses données du composant, et tout cela reste atteignable.
  - Des **nœuds DOM détachés** : une variable au niveau du module, un cache ou une bibliothèque tierce garde une référence vers des éléments DOM que React a déjà retirés.
  - Des **caches sans limite ou des tableaux/Maps au niveau du module** (caches de mémoïsation indexés par des objets, un `logs.push(...)` global).
  - Du travail asynchrone qui se termine après le démontage et met à jour quelque chose de global (ce n'est pas l'ancien avertissement « setState on unmounted component », que React 18 a supprimé parce que ce cas est la plupart du temps inoffensif).
- **Pattern de correction :** chaque effet qui démarre quelque chose renvoie un cleanup qui l'arrête. Utilisez `AbortController` pour les fetchs, et `WeakMap`/`WeakRef` ou des caches LRU bornés pour les caches indexés par des objets.
- **Débogage :** onglet Memory des Chrome DevTools. Prenez un heap snapshot, répétez plusieurs fois l'action suspecte (ouvrir/fermer une modale, quitter la page puis y revenir), forcez le GC, prenez un autre snapshot, puis utilisez la vue **Comparison** et filtrez sur « Detached » pour trouver le DOM détaché. Le panneau **Retainers** montre ce qui maintient un objet en vie. Le Performance monitor (« JS heap size », « DOM Nodes », « JS event listeners ») montre l'évolution dans le temps.

## Real-life example: the problem
Un dashboard de trading reste ouvert toute la journée par les traders. Après quelques heures à passer d'un instrument à l'autre, l'onglet consomme 2,5 Go de RAM, les graphiques saccadent, et Chrome finit par afficher « Aw, Snap! ». Le Performance monitor montre que « JS event listeners » et « DOM Nodes » augmentent à chaque changement d'instrument. La comparaison de heap snapshots révèle des milliers d'objets `Detached HTMLDivElement` et `Detached HTMLCanvasElement` retenus par la closure d'un listener `resize` et par le registre interne de la bibliothèque de graphiques.

```jsx
const priceHistoryCache = {}; // au niveau du module, grossit indéfiniment

function PriceChart({ symbol }) {
  const containerRef = useRef(null);
  const [ticks, setTicks] = useState([]);

  useEffect(() => {
    const chart = createChart(containerRef.current);           // jamais détruit
    const ws = new WebSocket(`wss://feed.example.com/${symbol}`); // jamais fermé
    ws.onmessage = e => {
      const tick = JSON.parse(e.data);
      priceHistoryCache[symbol] = [...(priceHistoryCache[symbol] ?? []), tick]; // sans limite
      setTicks(t => [...t, tick]);
      chart.update(tick);
    };
    window.addEventListener('resize', () => chart.resize());   // anonyme : impossible à retirer
    setInterval(() => chart.redraw(), 1000);                   // jamais arrêté
  }, [symbol]);

  return <div ref={containerRef} />;
}
```

Chaque changement de symbole relance l'effet : un nouveau graphique, une nouvelle socket, un nouveau listener et un nouvel intervalle à chaque fois, et les anciens continuent de tourner. Les anciens maintiennent aussi en vie, via leurs closures, l'instance de graphique précédente et son canvas (désormais détaché).

## How to fix it
```jsx
const MAX_TICKS = 5000;
const priceHistoryCache = new Map(); // borné plus bas ; pourrait aussi être un LRU

function PriceChart({ symbol }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const chart = createChart(containerRef.current);
    const ws = new WebSocket(`wss://feed.example.com/${symbol}`);

    ws.onmessage = e => {
      const tick = JSON.parse(e.data);
      const history = priceHistoryCache.get(symbol) ?? [];
      history.push(tick);
      if (history.length > MAX_TICKS) history.splice(0, history.length - MAX_TICKS);
      priceHistoryCache.set(symbol, history);
      chart.update(tick);             // le graphique gère le rendu ; pas de state React à chaque tick
    };

    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    const redrawId = setInterval(() => chart.redraw(), 1000);

    return () => {                    // s'exécute au démontage ET avant chaque nouvelle exécution de l'effet
      ws.close();
      window.removeEventListener('resize', onResize);
      clearInterval(redrawId);
      chart.destroy();                // libère le canvas et les références internes de la bibliothèque
    };
  }, [symbol]);

  return <div ref={containerRef} />;
}
```

Raccourci pour plusieurs listeners : créez un `AbortController` dans l'effet, passez `{ signal }` à chaque `addEventListener`, et appelez `controller.abort()` dans le cleanup.

Comment vérifier la correction :
1. DevTools, onglet Memory, Heap snapshot (référence).
2. Changez d'instrument 20 fois, revenez au premier, cliquez sur l'icône de corbeille (forcer le GC), prenez le snapshot 2.
3. Vue Comparison : le nombre de `Detached HTMLCanvasElement` et de `WebSocket` doit revenir au niveau de référence au lieu d'augmenter d'environ 20.
4. Performance monitor : « JS event listeners » reste stable.

Pourquoi ça marche : chaque exécution de l'effet s'annule désormais entièrement, donc rien en dehors du composant (window, timers, sockets, registre du graphique) ne garde de référence vers les anciennes closures ou l'ancien DOM. Une fois inatteignables, l'ancien graphique et son canvas sont libérés par le garbage collector. Le cache est plafonné, donc les longues sessions utilisent une mémoire bornée.

Astuce : en développement, le StrictMode de React 18+ monte, démonte puis remonte les composants, ce qui fait apparaître tôt les cleanups manquants (sockets en double, listeners doublés).

## How to say it in the interview
- « La plupart des fuites React viennent d'effets qui démarrent quelque chose (listener, timer, socket, observer, instance tierce) sans cleanup, et de références à longue durée de vie comme des caches de module ou des bibliothèques qui retiennent du DOM détaché. »
- « Je débogue en comparant des heap snapshots : je répète l'action, je force le GC, je compare, je filtre sur « Detached », et je remonte la chaîne des retainers jusqu'au code qui détient la référence. »
- Piège : « l'avertissement setState on unmounted component signifie une fuite ». React 18 a supprimé cet avertissement. La vraie fuite, c'est l'abonnement qui continue de tourner.
- Compromis : les caches améliorent la vitesse mais doivent être bornés (LRU, TTL, ou `WeakMap` pour les clés objets), sinon ce sont eux qui deviennent la fuite.
