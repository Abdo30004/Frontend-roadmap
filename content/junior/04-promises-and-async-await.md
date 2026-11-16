# What are Promises, and how do you handle async code with async/await?

**Level:** Junior
**Merged from (original phrasings):**
- What are Promises? Explain "async/await" with examples.
- How do you handle asynchronous code using async/await and Promises?

## The concept (short answer)
- A **Promise** is an object that represents a value that will be available later. It has 3 states: **pending**, **fulfilled** (with a value) or **rejected** (with an error). Once settled, it never changes.
- You read the result with `.then(onFulfilled)`, handle errors with `.catch(onError)`, and run cleanup with `.finally()`. Each `.then` returns a new Promise, so you can **chain** steps instead of nesting callbacks ("callback hell").
- `async/await` is syntax on top of Promises. An `async` function **always returns a Promise**. `await` pauses that function (not the whole page) until the Promise settles, then gives you the value or **throws** the error, so you use normal `try/catch`.
- Promise callbacks run as **microtasks**, after the current synchronous code and before timers (`setTimeout`).
- Combinators: `Promise.all` (run in parallel, fail fast if one fails), `Promise.allSettled` (wait for all, get each result/error), `Promise.race` (first to settle), `Promise.any` (first to succeed).

```js
// Same logic, two styles
fetch('/api/user')
  .then((res) => res.json())
  .then((user) => console.log(user.name))
  .catch((err) => console.error(err));

async function showUser() {
  try {
    const res = await fetch('/api/user');
    const user = await res.json();
    console.log(user.name);
  } catch (err) {
    console.error(err);
  }
}
```

## Real-life example: the problem
Imagine a travel-booking checkout page. It needs the user's profile, the cart and the available payment methods before showing the "Pay" button. Users complained that the page took **3+ seconds** to load. Sometimes it showed **"Total: $undefined"**, and when the payments API returned a 500 error, the spinner **spun forever** with no message.

Three bugs: requests run one after another without need, a missing `await` returns a Promise instead of data, and `fetch` does not reject on HTTP errors (only on network errors), so nothing caught the 500.

```js
// BROKEN: checkout.js
async function loadCheckout() {
  showSpinner();

  const profile = await fetch('/api/profile').then((r) => r.json());   // 1s
  const cart = await fetch('/api/cart').then((r) => r.json());         // 1s, waits for profile
  const methods = await fetch('/api/payment-methods').then((r) => r.json()); // 1s

  const total = calculateTotal(cart); // calculateTotal is async -> total is a Promise
  renderCheckout({ profile, cart, methods, total }); // shows "$undefined"
  hideSpinner(); // never reached if anything throws
}

async function calculateTotal(cart) {
  const res = await fetch('/api/pricing', { method: 'POST', body: JSON.stringify(cart) });
  return (await res.json()).total;
}

loadCheckout(); // no catch -> "Uncaught (in promise)" and endless spinner
```

## How to fix it

```js
// FIXED: checkout.js
async function getJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`${url} failed with status ${res.status}`); // turn HTTP errors into rejections
  }
  return res.json();
}

async function calculateTotal(cart) {
  const data = await getJSON('/api/pricing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cart),
  });
  return data.total;
}

async function loadCheckout() {
  showSpinner();
  try {
    // independent requests run in parallel: about 1s instead of 3s
    const [profile, cart, methods] = await Promise.all([
      getJSON('/api/profile'),
      getJSON('/api/cart'),
      getJSON('/api/payment-methods'),
    ]);

    const total = await calculateTotal(cart); // depends on cart, so it waits
    renderCheckout({ profile, cart, methods, total });
  } catch (err) {
    showError('We could not load your checkout. Please try again.');
    console.error(err);
  } finally {
    hideSpinner(); // always runs, success or error
  }
}

loadCheckout();
```

Why it works:
- `Promise.all` starts all three requests at once and waits for all of them. Only the pricing call, which needs the cart, waits.
- `await calculateTotal(cart)` unwraps the Promise into a number.
- `getJSON` checks `res.ok`, so a 500 becomes a thrown error, caught by `try/catch`; `finally` always hides the spinner.

Alternative: if one failing request should not break the whole page (e.g. optional recommendations), use `Promise.allSettled` and handle each result separately.

## How to say it in the interview
- "A Promise is a placeholder for a future value with three states: pending, fulfilled, rejected. `async/await` is syntax sugar over Promises that lets me write async code top-to-bottom and handle errors with `try/catch`."
- "I run independent requests in parallel with `Promise.all`; sequential `await`s in a row are a common performance mistake."
- Trap: `fetch` only rejects on network failure, not on 404/500. Always check `response.ok`.
- Trap: `await` inside `array.forEach` does not wait. Use `for...of` for sequential work, or `Promise.all(array.map(...))` for parallel work.
