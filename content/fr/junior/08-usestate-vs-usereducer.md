# Comment gérer le state en React avec useState et useReducer ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Comment gérez-vous le state en React avec useState et useReducer ?

## The concept (short answer)
- `useState(initial)` renvoie `[value, setValue]`. Appeler `setValue` planifie un re-render avec la nouvelle valeur. Idéal pour des valeurs **simples et indépendantes** : un booléen, une chaîne, un nombre.
- `useReducer(reducer, initialState)` renvoie `[state, dispatch]`. Vous faites `dispatch({ type: 'added', ... })` et une fonction **pure** `reducer(state, action)` renvoie le state suivant. Idéal quand le state comporte **plusieurs champs liés** ou **de nombreuses façons de changer**, car toute la logique de mise à jour se trouve au même endroit et se teste facilement.
- Le state doit être traité comme **immuable** : créez toujours de nouveaux objets ou tableaux (`{ ...state, x }`, `[...items, item]`). Si vous mutez et transmettez la même référence, React ne voit aucun changement et **ne fait pas de re-render**.
- Les mises à jour du state sont **regroupées** (batching) et la nouvelle valeur n'est visible qu'au **rendu suivant**. Quand la nouvelle valeur dépend de l'ancienne, utilisez la forme avec fonction de mise à jour : `setCount((c) => c + 1)`.
- State initial paresseux (lazy) pour une initialisation coûteuse : `useState(() => readFromLocalStorage())`.

```jsx
const [isOpen, setIsOpen] = useState(false);
setIsOpen((open) => !open);
```

## Real-life example: the problem
Imaginez le panier d'une application de livraison de repas. Les utilisateurs cliquaient rapidement sur « + » et la quantité augmentait de **1 au lieu de 3**. Ajouter un article ne **mettait parfois pas à jour le badge** dans l'en-tête. Et après la correction d'un bug dans un handler, le total et le nombre d'articles se sont **désynchronisés**, parce que la même logique avait été copiée-collée dans quatre handlers.

```jsx
// BUGUÉ : Cart.jsx
import { useState } from 'react';

export function Cart() {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);

  function addItem(dish) {
    items.push({ ...dish, qty: 1 });  // mutation : même référence de tableau -> pas de re-render
    setItems(items);
    setCount(count + 1);
    setTotal(total + dish.price);
  }

  function addThree(dish) {
    setCount(count + 1);              // les trois lisent le même ancien `count`
    setCount(count + 1);
    setCount(count + 1);              // résultat : +1, pas +3
  }

  function removeItem(id) {
    setItems(items.filter((i) => i.id !== id));
    setCount(count - 1);              // oubli de mettre à jour total -> désynchronisé
  }
  // ...
}
```

## How to fix it
Le panier contient des données liées qui doivent changer ensemble : déplacez-les dans un reducer. Ne stockez pas les valeurs que vous pouvez **calculer** (`count`, `total`) ; dérivez-les de `items`.

```jsx
// CORRIGÉ : Cart.jsx
import { useReducer } from 'react';

function cartReducer(state, action) {
  switch (action.type) {
    case 'added': {
      const existing = state.items.find((i) => i.id === action.dish.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === action.dish.id ? { ...i, qty: i.qty + action.qty } : i
          ),
        };
      }
      return { ...state, items: [...state.items, { ...action.dish, qty: action.qty }] };
    }
    case 'removed':
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case 'cleared':
      return { ...state, items: [] };
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

export function Cart() {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  // valeurs dérivées : toujours synchronisées, jamais stockées
  const count = state.items.reduce((n, i) => n + i.qty, 0);
  const total = state.items.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <section>
      <h2>Cart ({count})</h2>
      {state.items.map((item) => (
        <div key={item.id}>
          {item.name} x {item.qty}
          <button onClick={() => dispatch({ type: 'added', dish: item, qty: 1 })}>+</button>
          <button onClick={() => dispatch({ type: 'removed', id: item.id })}>Remove</button>
        </div>
      ))}
      <p>Total: ${total.toFixed(2)}</p>
    </section>
  );
}
```

Pourquoi ça marche :
- Le reducer renvoie toujours de **nouveaux** objets ou tableaux, donc React détecte le changement.
- React transmet le state **le plus récent** au reducer à chaque dispatch, donc trois clics rapides ajoutent bien 3.
- `count` et `total` sont calculés à partir de `items`, ils ne peuvent donc jamais se désynchroniser.
- Toutes les règles du panier se trouvent dans une seule fonction pure, que vous pouvez tester unitairement sans rendu.

Le même bug du « +3 » corrigé avec un simple `useState` : utilisez la fonction de mise à jour.

```jsx
setCount((c) => c + 1); // chaque appel reçoit la valeur la plus récente
setCount((c) => c + 1);
setCount((c) => c + 1); // +3
```

## How to say it in the interview
- « J'utilise `useState` pour des valeurs simples et indépendantes, et `useReducer` quand plusieurs valeurs changent ensemble ou que la logique de mise à jour devient complexe ; le reducer centralise la logique et se teste facilement. »
- « Le state est immuable : je crée de nouveaux objets et tableaux, sinon React compare les références, ne voit aucun changement et saute le re-render. »
- Piège : `setCount(count + 1)` trois fois donne +1, car `count` est la valeur de ce rendu-ci. Utilisez `setCount(c => c + 1)`.
- Compromis : `useReducer` ajoute du code répétitif (types d'actions, switch). Pour un toggle ou un champ texte, c'est excessif. Et ne stockez pas de données dérivées dans le state : calculez-les.
