# Quelle est la différence entre useEffect et useLayoutEffect ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Quelle est la différence entre « useEffect » et « useLayoutEffect » ?

## The concept (short answer)
- Les deux s'exécutent après que React a appliqué (commit) les changements au DOM. La différence, c'est **le moment, par rapport au paint du navigateur**.
- `useLayoutEffect` s'exécute **de façon synchrone après les mutations du DOM et avant que le navigateur ne peigne**. Si vous mettez à jour le state à l'intérieur, React refait le rendu de façon synchrone, et l'utilisateur ne voit que le résultat final. Il bloque le paint.
- `useEffect` s'exécute **après le paint** (en général). L'utilisateur peut apercevoir brièvement la première version de l'UI avant que votre effect ne la modifie, ce qui provoque un clignotement si l'effect change la mise en page.
- Règle : utilisez `useEffect` par défaut (data fetching, abonnements, logs, timers). N'utilisez `useLayoutEffect` que lorsque vous devez **mesurer le DOM et le modifier avant que l'utilisateur ne le voie** : positionnement de tooltip/popover, restauration du scroll, éléments qui s'auto-dimensionnent, maintien du scroll ancré en bas d'un chat.
- Ordre dans un commit : DOM mis à jour -> cleanups des layout effects + layout effects -> paint -> cleanups des effects passifs + effects.
- `useLayoutEffect` ne fait rien pendant le rendu serveur (React 18 émettait un avertissement, React 19 ne le fait plus). Le vrai problème reste le même : le HTML du serveur n'a aucune mesure, donc une UI basée sur des mesures doit d'abord afficher un fallback.
- `useInsertionEffect` existe pour que les bibliothèques CSS-in-JS injectent les styles avant les layout effects. Le code applicatif n'en a presque jamais besoin.

## Real-life example: the problem
Sur un dashboard d'analytics SaaS, survoler un point d'un graphique affiche un tooltip. Si le tooltip dépasse le bord droit de l'écran, il doit basculer à gauche. Les utilisateurs voient le tooltip apparaître à droite pendant une fraction de seconde, puis sauter à gauche. La QA l'appelle « le tooltip sauteur » ; c'est très visible sur les machines lentes.

```jsx
function Tooltip({ anchorRect, children }) {
  const ref = useRef(null);
  const [left, setLeft] = useState(anchorRect.right + 8);

  useEffect(() => {
    // BUG : s'exécute après que le navigateur a déjà peint le tooltip à l'ancienne position
    const { width } = ref.current.getBoundingClientRect();
    if (anchorRect.right + 8 + width > window.innerWidth) {
      setLeft(anchorRect.left - width - 8);
    }
  }, [anchorRect]);

  return (
    <div ref={ref} className="tooltip" style={{ position: 'fixed', top: anchorRect.top, left }}>
      {children}
    </div>
  );
}
```
Ce qui se passe : rendu 1 -> commit -> **paint (tooltip à droite, qui déborde)** -> l'effect mesure -> setLeft -> rendu 2 -> paint (tooltip à gauche). L'utilisateur voit deux frames.

## How to fix it
```jsx
import { useLayoutEffect, useRef, useState } from 'react';

function Tooltip({ anchorRect, children }) {
  const ref = useRef(null);
  const [left, setLeft] = useState(anchorRect.right + 8);

  useLayoutEffect(() => {
    // S'exécute après la mise à jour du DOM, AVANT le paint. Le re-render est synchrone.
    const { width } = ref.current.getBoundingClientRect();
    const fitsRight = anchorRect.right + 8 + width <= window.innerWidth;
    setLeft(fitsRight ? anchorRect.right + 8 : anchorRect.left - width - 8);
  }, [anchorRect]);

  return (
    <div ref={ref} className="tooltip" style={{ position: 'fixed', top: anchorRect.top, left }}>
      {children}
    </div>
  );
}
```
Pourquoi ça marche : React exécute le layout effect avant que le navigateur n'ait l'occasion de peindre. La mise à jour du state à l'intérieur est traitée de façon synchrone, donc la première frame que voit l'utilisateur a déjà la bonne position. Aucun clignotement.

Alternatives : pour le positionnement en particulier, utilisez une bibliothèque comme Floating UI (elle gère flip/shift/scroll), ou le positionnement par ancre CSS (anchor positioning) là où le support navigateur le permet. Pour les pages rendues côté serveur, n'affichez le tooltip que côté client (il n'apparaît de toute façon qu'au survol), ainsi le problème de mesure serveur/client ne se pose pas.

### Deuxième cas classique : l'ancrage du scroll dans un chat
```jsx
useLayoutEffect(() => {
  const el = listRef.current;
  // garder l'utilisateur en bas quand de nouveaux messages arrivent, sans saut visible
  if (wasAtBottomRef.current) el.scrollTop = el.scrollHeight;
}, [messages]);
```

## How to say it in the interview
- « `useEffect` s'exécute après le paint et ne le bloque pas. `useLayoutEffect` s'exécute après la mise à jour du DOM mais avant le paint, donc je ne l'utilise que pour mesurer la mise en page et la corriger sans clignotement. »
- Piège : mettre du data fetching ou une logique lourde dans `useLayoutEffect`. Il bloque le paint, donc la page paraît plus lente. Il doit rester court.
- Question de relance « est-ce que `useEffect` s'exécute toujours après le paint ? » : en général, oui, mais si la mise à jour vient d'un événement utilisateur discret (comme un clic) ou si un layout effect a mis à jour le state, React peut exécuter les effects passifs avant le paint. Ne comptez pas sur le timing de `useEffect` pour la justesse visuelle.
- Compromis : `useLayoutEffect` garantit la justesse visuelle au prix d'une frame bloquée. Avec le SSR, il ne peut pas s'exécuter sur le serveur, donc le premier HTML peut différer du résultat mesuré.
