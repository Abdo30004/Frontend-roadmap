# Why does calling setCount(count + 1) three times in one handler add only 1?

**Level:** Mid
**Merged from (original phrasings):**
- Why does setCount(count + 1) three times in one handler add only 1?

## The concept (short answer)
- `count` is a **constant snapshot** for the current render. Inside the handler it is, say, `0` the whole time. `setCount(count + 1)` three times is really `setCount(1)` three times.
- `setState` does not change the variable immediately. It **queues an update** and asks React to re-render. The new value only exists in the **next render**.
- React **batches** all updates from the same event into one re-render (in React 18+ this is automatic everywhere: event handlers, timeouts, Promises, native listeners).
- Fix: use the **updater function** `setCount(c => c + 1)`. React runs the queued updaters in order, each one receiving the result of the previous one: 0 -> 1 -> 2 -> 3.
- Rule of thumb: if the new state depends on the previous state, use the updater form.

```js
// Queue processing for one render:
setCount(count + 1); // replace with 1
setCount(count + 1); // replace with 1
setCount(count + 1); // replace with 1   -> result 1

setCount(c => c + 1); // 0 -> 1
setCount(c => c + 1); // 1 -> 2
setCount(c => c + 1); // 2 -> 3          -> result 3
```

## Real-life example: the problem
On a grocery delivery checkout, the "+" button on a cart item calls `addOne()`. The product team adds a "+3 bundle" button that just calls it three times, and also a quick-add that fires on double-click. Customers click "+3" and the quantity goes from 2 to 3, not 5. Some users click fast and the counter lags behind their clicks. The bug also hides a second problem: the analytics call logs the **old** quantity.

```jsx
function CartItem({ item }) {
  const [qty, setQty] = useState(item.qty);

  const addOne = () => {
    setQty(qty + 1);
  };

  const addBundle = () => {
    addOne();
    addOne();
    addOne(); // qty is still 2 in all three calls -> result 3
    track('bundle_added', { qty }); // logs 2: the snapshot, not the new value
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
    setQty((q) => Math.min(q + n, item.maxQty)); // updater: always uses the latest queued value
  };

  const addBundle = () => {
    const next = Math.min(qty + 3, item.maxQty); // compute the value once if you need it now
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
Why it works:
- The updater function `q => q + n` does not read the stale `qty` from the closure. React passes the latest pending value to each updater in order, so three calls to `add(1)` correctly give `+3`.
- If you need the new value in the same handler (for analytics, an API call), **calculate it into a local variable** and use that variable for both `setQty` and the side effect. Don't read state right after setting it.

Alternatives: if several fields change together (qty, price, discount), use `useReducer` so the logic lives in one place and always sees the current state. `flushSync` can force a synchronous render, but it is rarely the right fix and it hurts performance.

### Batching in React 18+
```jsx
setTimeout(() => {
  setQty((q) => q + 1);
  setLoading(false);
  // React 17: two renders (no batching outside React events)
  // React 18+: one render (automatic batching)
}, 1000);
```

## How to say it in the interview
- "State is a snapshot per render. `setCount(count + 1)` uses the same `count` three times, and React batches the three updates into one render, so the result is +1. The updater form `setCount(c => c + 1)` chains them."
- Trap/follow-up: "Why does `console.log(count)` right after `setCount` print the old value?" Because the variable in this render never changes. The new value appears in the next render.
- "React 18 batches automatically everywhere, including in timeouts and Promises. Before React 18, only React event handlers were batched."
- Trade-off: batching gives fewer renders and better performance, but you must never rely on state being updated synchronously. Derive values locally when you need them immediately.
