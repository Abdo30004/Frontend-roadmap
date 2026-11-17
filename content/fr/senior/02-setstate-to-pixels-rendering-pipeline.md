# De setState aux pixels : les mises à jour React et le pipeline de rendu du navigateur

**Niveau :** Senior
**Merged from (original phrasings):**
- Décrivez tout ce qui se passe entre setState et le changement des pixels.
- Expliquez le pipeline de rendu du navigateur : DOM, CSSOM, layout, paint et compositing.

## The concept (short answer)

**Côté React**
1. **Planification :** `setState` ne déclenche pas de rendu. Il met en file une mise à jour sur la fiber du composant, lui attribue une **lane** (sync pour un clic, transition pour `startTransition`, ...) et planifie la racine. Les mises à jour d'un même tick sont **regroupées** (batching ; React 18 : partout, y compris dans les promises et les timeouts).
2. **Phase de render :** React appelle vos composants, réconcilie les nouveaux éléments avec l'arbre de fibers courant et marque ce qui a changé. Pure, sans toucher au DOM, interruptible pour les lanes non urgentes.
3. **Phase de commit (synchrone) :** mutations du DOM (insertion / mise à jour / suppression de nœuds), attachement des refs, puis exécution de **`useLayoutEffect`** - après les écritures DOM mais *avant* que le navigateur ne peigne (lire le layout ici force un layout synchrone).
4. **`useEffect`** s'exécute après que le navigateur a eu l'occasion de peindre (effets passifs), donc il ne bloque pas la frame. (React 18 les exécute de manière synchrone pour les entrées discrètes comme les clics.)

**Côté navigateur** (une fois que le JS a libéré le main thread)
1. **Parsing :** HTML -> **DOM**, CSS -> **CSSOM**.
2. **Recalcul des styles :** correspondance des sélecteurs, calcul des styles de chaque élément (render tree = nœuds visibles + styles calculés).
3. **Layout (reflow) :** calcul de la géométrie - taille et position de chaque boîte.
4. **Paint :** enregistrement des commandes de dessin (texte, couleurs, bordures, ombres) dans des calques.
5. **Composite :** le thread du compositor (GPU) assemble les calques pour produire la frame finale.

Conséquences clés : modifier `width`/`top`/`font-size` déclenche layout + paint + composite ; modifier `color`/`background` déclenche paint + composite ; modifier **`transform`/`opacity`** sur un calque promu ne déclenche **que le composite** et peut s'exécuter sur le thread du compositor même si le main thread est occupé. Et **lire** une propriété de layout (`offsetHeight`, `getBoundingClientRect`, `scrollTop`) après une **écriture** oblige le navigateur à exécuter style + layout de façon synchrone, immédiatement - c'est le **forced synchronous layout** ; le faire dans une boucle, c'est du **layout thrashing**.

## Real-life example: the problem

Un tableau Kanban de gestion de projet. Chaque colonne égalise la hauteur des cartes pour aligner les lignes, et le tiroir latéral glisse en animant `left`. Avec 300 cartes, l'ouverture d'un tableau fige l'interface pendant environ 800ms sur un portable et plusieurs secondes sur des téléphones milieu de gamme ; l'animation du tiroir saccade. Le panneau Performance montre une longue bande violette « Layout » répétée des centaines de fois avec l'avertissement « Forced reflow is a likely performance bottleneck ».

```jsx
function Column({ cards }) {
  const listRef = useRef(null);

  useLayoutEffect(() => {
    const nodes = listRef.current.querySelectorAll('.card');
    let max = 0;
    nodes.forEach((node) => {
      node.style.height = 'auto';                 // ÉCRITURE (invalide le layout)
      max = Math.max(max, node.offsetHeight);     // LECTURE  (force le layout MAINTENANT)
      node.style.height = `${max}px`;             // ÉCRITURE (invalide à nouveau)
    });
  }, [cards]);

  return <ul ref={listRef}>{cards.map((c) => <li className="card" key={c.id}>{c.title}</li>)}</ul>;
}
```

```css
/* Animer une propriété de layout : layout + paint à chaque frame, sur le main thread */
.drawer { position: fixed; top: 0; left: -400px; width: 400px; transition: left 300ms; }
.drawer.open { left: 0; }
```

Chaque itération alterne écriture -> lecture, donc le navigateur recalcule le layout de toute la colonne 300 fois au lieu d'une. Et comme `left` est une propriété de layout, chaque frame de l'animation nécessite layout + paint sur le main thread - précisément celui qui est occupé.

## How to fix it

Regroupez d'abord toutes les **lectures**, puis toutes les **écritures** (un seul layout au lieu de N), et n'animez que des propriétés que le compositor sait gérer seul.

```jsx
function Column({ cards }) {
  const listRef = useRef(null);

  useLayoutEffect(() => {
    const nodes = [...listRef.current.querySelectorAll('.card')];
    nodes.forEach((n) => { n.style.height = 'auto'; });     // toutes les écritures
    const heights = nodes.map((n) => n.offsetHeight);      // un seul layout forcé, puis des lectures en cache
    const max = Math.max(...heights);
    nodes.forEach((n) => { n.style.height = `${max}px`; }); // toutes les écritures
  }, [cards]);

  return <ul ref={listRef}>{cards.map((c) => <li className="card" key={c.id}>{c.title}</li>)}</ul>;
}
```

Encore mieux, supprimez le JS : une grille CSS avec `grid-auto-rows: 1fr` égalise les lignes sans aucun script ni layout forcé.

```css
.drawer {
  position: fixed; top: 0; left: 0; width: 400px;
  transform: translateX(-100%);
  transition: transform 300ms ease-out;
  will-change: transform; /* promeut l'élément sur son propre calque ; avec parcimonie, les calques coûtent de la mémoire */
}
.drawer.open { transform: translateX(0); }
```

Pourquoi ça marche : en regroupant lectures et écritures, le layout n'est calculé qu'une fois par passe. `transform` est appliqué par le compositor sur un calque déjà peint, donc le glissement reste à 60fps même si React est occupé à rendre le contenu du tiroir. Pour coordonner des lectures / écritures DOM complexes entre plusieurs composants, planifiez les lectures dans un `requestAnimationFrame` et les écritures dans le suivant (le pattern fastdom), ou utilisez `ResizeObserver` au lieu d'interroger les tailles en boucle.

## How to say it in the interview

- « setState ne fait que planifier ; React rend et calcule le diff dans une phase pure et interruptible, applique les mutations DOM de façon synchrone, exécute les layout effects avant le paint et les effets passifs après. Ensuite, le navigateur enchaîne style, layout, paint et composite. »
- « Le changement le moins coûteux est celui que le compositor peut faire seul : transform et opacity. Tout ce qui touche à la géométrie paie le layout et le paint. »
- Piège : un `useLayoutEffect` qui lit le layout est un forced synchronous layout - acceptable une fois, catastrophique dans une boucle. Question de suivi : « Pourquoi `useLayoutEffect` existe-t-il ? » - pour mesurer et corriger avant le paint afin d'éviter un scintillement visible (tooltips, positionnement de popovers).
- Compromis : `will-change` / la promotion en calque rend l'animation fluide, mais chaque calque coûte de la mémoire GPU ; promouvoir des centaines d'éléments peut rendre les téléphones d'entrée de gamme plus lents, pas plus rapides.
