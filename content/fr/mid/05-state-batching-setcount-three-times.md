# Pourquoi appeler setCount(count + 1) trois fois dans un même handler n'ajoute-t-il que 1 ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Pourquoi appeler setCount(count + 1) trois fois dans un même handler n'ajoute-t-il que 1 ?

## The concept (short answer)
- `count` est un **instantané constant** propre au rendu courant. Dans le handler, il vaut par exemple `0` du début à la fin. Appeler `setCount(count + 1)` trois fois revient en réalité à appeler `setCount(1)` trois fois.
- `setState` ne modifie pas la variable immédiatement. Il **met une mise à jour en file** et demande à React de refaire un rendu. La nouvelle valeur n'existe que dans le **rendu suivant**.
- React **regroupe** (batching) toutes les mises à jour d'un même événement en un seul re-render (depuis React 18, c'est automatique partout : event handlers, timeouts, Promises, listeners natifs).
- Solution : utilisez la **fonction updater** `setCount(c => c + 1)`. React exécute les updaters en file dans l'ordre, chacun recevant le résultat du précédent : 0 -> 1 -> 2 -> 3.
- Règle empirique : si le nouveau state dépend du state précédent, utilisez la forme updater.

```js
// Traitement de la file pour un rendu :
setCount(count + 1); // remplacer par 1
setCount(count + 1); // remplacer par 1
setCount(count + 1); // remplacer par 1   -> résultat 1

setCount(c => c + 1); // 0 -> 1
setCount(c => c + 1); // 1 -> 2
setCount(c => c + 1); // 2 -> 3          -> résultat 3
```

## Real-life example: the problem
Sur le checkout d'une app de livraison de courses, le bouton « + » d'un article du panier appelle `addOne()`. L'équipe produit ajoute un bouton « +3 bundle » (un lot de trois) qui l'appelle simplement trois fois, ainsi qu'un ajout rapide déclenché au double-clic. Les clients cliquent sur « +3 » et la quantité passe de 2 à 3, et non à 5. Certains utilisateurs cliquent vite et le compteur est en retard sur leurs clics. Le bug cache aussi un second problème : l'appel analytics enregistre l'**ancienne** quantité.

```jsx
function CartItem({ item }) {
  const [qty, setQty] = useState(item.qty);

  const addOne = () => {
    setQty(qty + 1);
  };

  const addBundle = () => {
    addOne();
    addOne();
    addOne(); // qty vaut toujours 2 dans les trois appels -> résultat 3
    track('bundle_added', { qty }); // enregistre 2 : l'instantané, pas la nouvelle valeur
  };

  return (
    <div>
      <span>{qty}</span>
      <button onClick={addOne}>+</button>
      <button onClick={addBundle}>+3 bundle</button>
    </div>
  );
}
```

## How to fix it
```jsx
function CartItem({ item }) {
  const [qty, setQty] = useState(item.qty);

  const add = (n = 1) => {
    setQty((q) => Math.min(q + n, item.maxQty)); // updater : utilise toujours la dernière valeur en file
  };

  const addBundle = () => {
    const next = Math.min(qty + 3, item.maxQty); // calculer la valeur une seule fois si vous en avez besoin tout de suite
    setQty(next);
    track('bundle_added', { qty: next });
  };

  return (
    <div>
      <span>{qty}</span>
      <button onClick={() => add(1)}>+</button>
      <button onClick={addBundle}>+3 bundle</button>
    </div>
  );
}
```
Pourquoi ça marche :
- La fonction updater `q => q + n` ne lit pas le `qty` périmé capturé par la closure. React transmet la dernière valeur en attente à chaque updater, dans l'ordre, donc trois appels à `add(1)` donnent bien `+3`.
- Si vous avez besoin de la nouvelle valeur dans le même handler (pour l'analytics, un appel API), **calculez-la dans une variable locale** et utilisez cette variable à la fois pour `setQty` et pour l'effet de bord. Ne lisez pas le state juste après l'avoir mis à jour.

Alternatives : si plusieurs champs changent ensemble (quantité, prix, remise), utilisez `useReducer` pour que la logique soit centralisée et voie toujours le state courant. `flushSync` peut forcer un rendu synchrone, mais c'est rarement la bonne solution et cela nuit aux performances.

### Le batching depuis React 18
```jsx
setTimeout(() => {
  setQty((q) => q + 1);
  setLoading(false);
  // React 17 : deux rendus (pas de batching en dehors des événements React)
  // React 18+ : un seul rendu (batching automatique)
}, 1000);
```

## How to say it in the interview
- « Le state est un instantané propre à chaque rendu. `setCount(count + 1)` utilise trois fois le même `count`, et React regroupe les trois mises à jour en un seul rendu, d'où le +1. La forme updater `setCount(c => c + 1)` les enchaîne. »
- Piège / relance : « Pourquoi `console.log(count)` juste après `setCount` affiche-t-il l'ancienne valeur ? » Parce que la variable de ce rendu ne change jamais. La nouvelle valeur apparaît au rendu suivant.
- « React 18 fait du batching automatique partout, y compris dans les timeouts et les Promises. Avant React 18, seuls les event handlers React étaient regroupés. »
- Compromis : le batching réduit le nombre de rendus et améliore les performances, mais vous ne devez jamais compter sur une mise à jour synchrone du state. Calculez les valeurs localement quand vous en avez besoin immédiatement.
