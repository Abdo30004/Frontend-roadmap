# What is the difference between setTimeout() and setInterval()?

**Level:** Junior
**Merged from (original phrasings):**
- What is the difference between "setTimeout()" and "setInterval()"?

## The concept (short answer)
- `setTimeout(fn, delay)` runs `fn` **once**, after at least `delay` ms. Cancel with `clearTimeout(id)`.
- `setInterval(fn, delay)` runs `fn` **again and again**, every `delay` ms, until you call `clearInterval(id)`.
- Both return an id, and both are scheduled by the browser and pushed to the **task queue**. The callback only runs when the call stack is empty, so the delay is a **minimum**, not a guarantee. A busy main thread or a background tab (browsers throttle timers to about 1 per second or less) makes them late.
- `setInterval` does not wait for your work to finish. If the callback starts an async request that takes longer than the interval, requests **pile up and overlap**.
- A **recursive `setTimeout`** (schedule the next run at the end of the current one) guarantees a gap between runs and is safer for polling.
- Always clean up: a forgotten interval keeps running after the user leaves the page or the component unmounts.

```js
const id1 = setTimeout(() => console.log('once after 1s'), 1000);
const id2 = setInterval(() => console.log('every 1s'), 1000);
clearInterval(id2); // stop it
```

## Real-life example: the problem
Imagine a banking dashboard that refreshes the account balance every 5 seconds. On a slow mobile network, the `/api/balance` request sometimes takes 8 seconds. Users saw the balance **jump back and forth** between old and new values, and the backend team saw traffic spikes. Also, when users navigated to another page in the React app, the network tab showed the requests **kept going** forever, and after a few visits to the page several intervals were polling at once.

Two bugs: `setInterval` fires new requests while old ones are still pending (responses arrive out of order), and the interval is never cleared on unmount.

```jsx
// BROKEN: BalanceCard.jsx
import { useEffect, useState } from 'react';

export function BalanceCard({ accountId }) {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    setInterval(async () => {
      const res = await fetch(`/api/accounts/${accountId}/balance`);
      const data = await res.json();
      setBalance(data.amount); // a slow old response can overwrite a newer one
    }, 5000);
    // no cleanup -> interval runs forever, even after unmount
  }, [accountId]);

  return <p>Balance: {balance ?? 'Loading...'}</p>;
}
```

## How to fix it
Use a recursive `setTimeout`: wait for the request to finish, then schedule the next one. Clear the timer in the effect cleanup.

```jsx
// FIXED: BalanceCard.jsx
import { useEffect, useState } from 'react';

export function BalanceCard({ accountId }) {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    let timeoutId;
    let stopped = false;

    async function poll() {
      try {
        const res = await fetch(`/api/accounts/${accountId}/balance`);
        const data = await res.json();
        if (!stopped) setBalance(data.amount);
      } catch (err) {
        console.error('Balance refresh failed', err);
      } finally {
        if (!stopped) {
          timeoutId = setTimeout(poll, 5000); // next run starts 5s AFTER this one ends
        }
      }
    }

    poll(); // first load immediately

    return () => {
      stopped = true;
      clearTimeout(timeoutId); // stop polling on unmount or accountId change
    };
  }, [accountId]);

  return <p>Balance: {balance ?? 'Loading...'}</p>;
}
```

Why it works: only one request is in flight at a time, so responses can never arrive out of order. The `stopped` flag and `clearTimeout` stop everything when the component unmounts or `accountId` changes.

When `setInterval` is fine: short, synchronous work with no overlap risk, like a countdown clock (and still clear it in cleanup). For real-time data, consider WebSockets or a data library (TanStack Query `refetchInterval`) instead of manual polling.

## How to say it in the interview
- "`setTimeout` runs once after a minimum delay; `setInterval` repeats until cleared. Both are just the minimum delay, because callbacks wait in the task queue for the call stack to be empty."
- "For polling an API, I prefer recursive `setTimeout`, because `setInterval` does not wait for the async work and requests can overlap."
- Trap: forgetting `clearInterval`/`clearTimeout` in the React `useEffect` cleanup causes leaks and duplicate timers (very visible in React StrictMode in development, which mounts effects twice).
- Follow-up: "Why does my timer drift?" Each tick can be late, so for clocks, compute the time from `Date.now()` instead of counting ticks.
