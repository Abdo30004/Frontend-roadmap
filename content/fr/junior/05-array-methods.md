# Expliquez les méthodes de tableau JavaScript (map, filter, reduce, forEach, etc.)

**Niveau :** Junior
**Merged from (original phrasings):**
- Expliquez les méthodes de tableau JavaScript (« map », « filter », « reduce », « forEach », etc.).

## The concept (short answer)
Chaque méthode prend un callback `(item, index, array)`. L'essentiel est de savoir **ce que chacune renvoie** et **si elle modifie le tableau d'origine**.

| Méthode | Renvoie | À utiliser pour |
|---|---|---|
| `map` | un nouveau tableau, de même longueur | transformer chaque élément |
| `filter` | un nouveau tableau, de même longueur ou plus court | garder les éléments qui passent un test |
| `reduce` | une seule valeur (de n'importe quel type) | faire une somme, regrouper, construire un objet |
| `forEach` | `undefined` | effets de bord uniquement (log, DOM, analytics) ; impossible de faire `break` |
| `find` / `findIndex` | la première correspondance / son index (`undefined` / `-1`) | rechercher un élément |
| `some` / `every` | booléen | « y en a-t-il au moins un ? » / « le sont-ils tous ? » (s'arrête dès que possible) |
| `includes` | booléen | vérifier la présence d'une valeur primitive |
| `flatMap` | un nouveau tableau aplati | map + aplatissement d'un niveau |

- **Non mutantes :** `map`, `filter`, `reduce`, `slice`, `concat`, `toSorted`, `toReversed` (ES2023).
- **Mutantes (modifient l'original) :** `push`, `pop`, `splice`, `sort`, `reverse`. C'est très important en React, où le state ne doit pas être muté.
- `sort()` sans fonction de comparaison trie en tant que **chaînes de caractères** : `[10, 9, 1].sort()` donne `[1, 10, 9]`. Utilisez `(a, b) => a - b`.
- Les méthodes peuvent être **enchaînées**, car `map`/`filter` renvoient des tableaux : `orders.filter(...).map(...)`.

```js
const prices = [20, 5, 50];
prices.map((p) => p * 1.2);            // [24, 6, 60]
prices.filter((p) => p > 10);          // [20, 50]
prices.reduce((sum, p) => sum + p, 0); // 75
prices.find((p) => p > 10);            // 20
prices.some((p) => p > 40);            // true
```

## Real-life example: the problem
Imaginez la page panier d'une épicerie en ligne, en React. Les utilisateurs ont signalé trois choses : le total du panier affichait **« 0 »** ou une chaîne bizarre comme **« [object Object]2.5 »**, la liste des produits **changeait d'ordre** dans une autre partie de la page après un clic sur « Trier par prix », et la liste des articles était vide.

```jsx
// BUGUÉ : Cart.jsx
export function Cart({ items }) {
  // items : [{ id, name, price, qty, inStock }]

  // 1. forEach renvoie undefined -> rien à afficher
  const rows = items.forEach((item) => (
    <li key={item.id}>{item.name} x {item.qty}</li>
  ));

  // 2. reduce sans valeur initiale : le premier accumulateur est un objet
  const total = items.reduce((sum, item) => sum + item.price * item.qty);

  // 3. sort() mute la prop `items` sur place, et trie les nombres comme des chaînes
  const byPrice = items.sort((a, b) => a.price > b.price);

  return (
    <>
      <ul>{rows}</ul>
      <p>Total: ${total}</p>
      <p>Cheapest: {byPrice[0].name}</p>
    </>
  );
}
```

Ce qui n'allait pas :
1. `forEach` renvoie toujours `undefined`, donc la liste est vide.
2. Sans valeur initiale, `reduce` utilise le premier **objet article** comme `sum` de départ, donc `objet + nombre` devient une concaténation de chaînes.
3. `sort` modifie le tableau du parent (une prop), ce qui casse les autres composants qui utilisent les mêmes données. De plus, le comparateur renvoie un booléen et non un nombre, donc l'ordre n'est pas fiable.

## How to fix it

```jsx
// CORRIGÉ : Cart.jsx
export function Cart({ items }) {
  const inStock = items.filter((item) => item.inStock);

  const rows = inStock.map((item) => (
    <li key={item.id}>
      {item.name} x {item.qty}
    </li>
  ));

  const total = inStock.reduce((sum, item) => sum + item.price * item.qty, 0); // commence à 0

  const byPrice = inStock.toSorted((a, b) => a.price - b.price); // copie, comparaison numérique
  // navigateurs plus anciens : [...inStock].sort((a, b) => a.price - b.price)

  if (inStock.length === 0) return <p>Your cart is empty.</p>;

  return (
    <>
      <ul>{rows}</ul>
      <p>Total: ${total.toFixed(2)}</p>
      <p>Cheapest: {byPrice[0].name}</p>
    </>
  );
}
```

Pourquoi ça marche : `map` renvoie un nouveau tableau d'éléments JSX que React peut afficher. `reduce` part de `0`, donc l'accumulateur est toujours un nombre. `toSorted` (ou une copie préalable avec le spread) laisse la prop d'origine intacte, et `a.price - b.price` renvoie un nombre négatif, nul ou positif, comme `sort` l'attend. Enchaîner `filter` + `map` garde chaque étape simple.

Un pattern `reduce` utile, le regroupement :

```js
const byCategory = items.reduce((groups, item) => {
  (groups[item.category] ??= []).push(item);
  return groups;
}, {});
// Alternative moderne : Object.groupBy(items, (item) => item.category)
```

## How to say it in the interview
- « `map` transforme, `filter` sélectionne, `reduce` combine en une seule valeur, et `forEach` ne sert qu'aux effets de bord, car il renvoie `undefined`. »
- « En React, j'affiche les listes avec `map`, jamais avec `forEach`, et j'évite les méthodes mutantes comme `sort` et `splice` sur le state ou les props ; je fais d'abord une copie, ou j'utilise `toSorted`. »
- Piège : passez toujours une valeur initiale à `reduce` ; sans elle, un tableau vide lève une `TypeError`.
- Compromis : enchaîner `filter().map()` parcourt le tableau deux fois. Pour des listes d'UI classiques, c'est très bien et lisible ; ne fusionnez en un seul `reduce` ou une boucle `for` que si le profiling montre un vrai coût sur de très grands tableaux.
