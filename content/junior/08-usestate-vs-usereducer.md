# How do you manage state in React with useState and useReducer?

**Level:** Junior
**Merged from (original phrasings):**
- How do you manage state in React using useState and useReducer?

## The concept (short answer)
- `useState(initial)` returns `[value, setValue]`. Calling `setValue` schedules a re-render with the new value. Best for **simple, independent** values: a boolean, a string, a number.
- `useReducer(reducer, initialState)` returns `[state, dispatch]`. You `dispatch({ type: 'added', ... })` and a **pure** `reducer(state, action)` function returns the next state. Best when state has **several related fields** or **many ways to change**, because all the update logic lives in one place and is easy to test.
- State must be treated as **immutable**: always create new objects/arrays (`{ ...state, x }`, `[...items, item]`). If you mutate and pass the same reference, React sees no change and **does not re-render**.
- State updates are **batched** and the new value is only visible on the **next render**. When the new value depends on the old one, use the updater form: `setCount((c) => c + 1)`.
- Lazy initial state for expensive setup: `useState(() => readFromLocalStorage())`.

```jsx
const [isOpen, setIsOpen] = useState(false);
setIsOpen((open) => !open);
```

## Real-life example: the problem
Imagine a food-delivery app's cart. Users clicked "+" quickly and the quantity went up by **1 instead of 3**. Adding an item sometimes **did not update the badge** in the header. And after a bug fix in one handler, the total and item count got **out of sync** because the same logic was copy-pasted into four handlers.

```jsx
// BROKEN: Cart.jsx
import { useState } from 'react';

export function Cart() {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);

  function addItem(dish) {
    items.push({ ...dish, qty: 1 });  // mutation: same array reference -> no re-render
    setItems(items);
    setCount(count + 1);
    setTotal(total + dish.price);
  }

  function addThree(dish) {
    setCount(count + 1);              // all three read the same old `count`
    setCount(count + 1);
    setCount(count + 1);              // result: +1, not +3
  }

  function removeItem(id) {
    setItems(items.filter((i) => i.id !== id));
    setCount(count - 1);              // forgot to update total -> out of sync
  }
  // ...
}
```

## How to fix it
The cart has related data that must change together, so move it into a reducer. Do not store values you can **compute** (`count`, `total`); derive them from `items`.

```jsx
// FIXED: Cart.jsx
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

  // derived values: always in sync, never stored
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

Why it works:
- The reducer always returns **new** objects/arrays, so React detects the change.
- React passes the **latest** state to the reducer for each dispatch, so three quick clicks add 3.
- `count` and `total` are computed from `items`, so they can never get out of sync.
- All cart rules live in one pure function you can unit test without rendering.

The same "+3" bug fixed with plain `useState`: use the updater function.

```jsx
setCount((c) => c + 1); // each call gets the latest value
setCount((c) => c + 1);
setCount((c) => c + 1); // +3
```

## How to say it in the interview
- "I use `useState` for simple independent values and `useReducer` when several values change together or the update logic gets complex; the reducer centralizes the logic and is easy to test."
- "State is immutable: I create new objects and arrays, otherwise React compares references, sees no change and skips the re-render."
- Trap: `setCount(count + 1)` three times gives +1, because `count` is the value from this render. Use `setCount(c => c + 1)`.
- Trade-off: `useReducer` adds boilerplate (action types, switch). For a toggle or a text input it is overkill. Also do not store derived data in state; compute it.
