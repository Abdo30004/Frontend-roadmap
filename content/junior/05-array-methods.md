# Explain JavaScript array methods (map, filter, reduce, forEach, etc.)

**Level:** Junior
**Merged from (original phrasings):**
- Explain JavaScript array methods ("map", "filter", "reduce", "forEach", etc.).

## The concept (short answer)
Each method takes a callback `(item, index, array)`. The key is knowing **what each one returns** and **whether it changes the original array**.

| Method | Returns | Use it to |
|---|---|---|
| `map` | new array, same length | transform each item |
| `filter` | new array, same or shorter | keep items that pass a test |
| `reduce` | a single value (any type) | sum, group, build an object |
| `forEach` | `undefined` | side effects only (log, DOM, analytics); cannot `break` |
| `find` / `findIndex` | first match / its index (`undefined` / `-1`) | look up one item |
| `some` / `every` | boolean | "is there any?" / "are all?" (stop early) |
| `includes` | boolean | check a primitive value |
| `flatMap` | new flattened array | map + flatten one level |

- **Non-mutating:** `map`, `filter`, `reduce`, `slice`, `concat`, `toSorted`, `toReversed` (ES2023).
- **Mutating (change the original):** `push`, `pop`, `splice`, `sort`, `reverse`. This matters a lot in React, where state must not be mutated.
- `sort()` without a compare function sorts as **strings**: `[10, 9, 1].sort()` gives `[1, 10, 9]`. Use `(a, b) => a - b`.
- Methods can be **chained** because `map`/`filter` return arrays: `orders.filter(...).map(...)`.

```js
const prices = [20, 5, 50];
prices.map((p) => p * 1.2);            // [24, 6, 60]
prices.filter((p) => p > 10);          // [20, 50]
prices.reduce((sum, p) => sum + p, 0); // 75
prices.find((p) => p > 10);            // 20
prices.some((p) => p > 40);            // true
```

## Real-life example: the problem
Imagine an online grocery store's cart page in React. Users reported three things: the cart total showed **"0"** or a weird string like **"[object Object]2.5"**, the product list **changed order** on another part of the page after clicking "Sort by price", and the item list was empty.

```jsx
// BROKEN: Cart.jsx
export function Cart({ items }) {
  // items: [{ id, name, price, qty, inStock }]

  // 1. forEach returns undefined -> nothing to render
  const rows = items.forEach((item) => (
    <li key={item.id}>{item.name} x {item.qty}</li>
  ));

  // 2. reduce without an initial value: the first accumulator is an object
  const total = items.reduce((sum, item) => sum + item.price * item.qty);

  // 3. sort() mutates the `items` prop in place, and sorts numbers as strings
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

What went wrong:
1. `forEach` always returns `undefined`, so the list is empty.
2. Without an initial value, `reduce` uses the first **item object** as the starting `sum`, so `object + number` becomes string concatenation.
3. `sort` changes the parent's array (a prop), which breaks other components using the same data. Also the comparator returns a boolean, not a number, so the order is unreliable.

## How to fix it

```jsx
// FIXED: Cart.jsx
export function Cart({ items }) {
  const inStock = items.filter((item) => item.inStock);

  const rows = inStock.map((item) => (
    <li key={item.id}>
      {item.name} x {item.qty}
    </li>
  ));

  const total = inStock.reduce((sum, item) => sum + item.price * item.qty, 0); // start at 0

  const byPrice = inStock.toSorted((a, b) => a.price - b.price); // copy, numeric compare
  // older browsers: [...inStock].sort((a, b) => a.price - b.price)

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

Why it works: `map` returns a new array of JSX elements that React can render. `reduce` starts from `0`, so the accumulator is always a number. `toSorted` (or spreading into a copy first) leaves the original prop untouched, and `a.price - b.price` returns a negative/zero/positive number as `sort` expects. `filter` + `map` chaining keeps each step simple.

A useful `reduce` pattern, grouping:

```js
const byCategory = items.reduce((groups, item) => {
  (groups[item.category] ??= []).push(item);
  return groups;
}, {});
// Modern alternative: Object.groupBy(items, (item) => item.category)
```

## How to say it in the interview
- "`map` transforms, `filter` selects, `reduce` combines into one value, and `forEach` is only for side effects because it returns `undefined`."
- "In React I render lists with `map`, never `forEach`, and I avoid mutating methods like `sort` and `splice` on state or props; I copy first or use `toSorted`."
- Trap: always pass an initial value to `reduce`; without it, an empty array throws `TypeError`.
- Trade-off: chaining `filter().map()` loops twice. For normal UI lists that is fine and readable; only merge into one `reduce` or `for` loop when profiling shows a real cost on very large arrays.
