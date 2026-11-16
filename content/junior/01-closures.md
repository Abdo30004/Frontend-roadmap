# What is a closure in JavaScript, and how do you use one?

**Level:** Junior
**Merged from (original phrasings):**
- What is a Closure? Explain with an example.
- What are closures in JavaScript and how do you use them?

## The concept (short answer)
- A **closure** is a function together with the variables from the scope where it was **created**. The function keeps access to those variables even after the outer function has returned.
- Why it works: JavaScript uses **lexical scope**. When a function is created, it keeps a reference to its surrounding scope. As long as the inner function is reachable, that scope stays in memory and is not garbage-collected.
- The function holds a **live reference** to the variable, not a copy of its value. If the variable changes later, the closure sees the new value.
- Everyday uses: private state (counters, caches), function factories (`makeFormatter('EUR')`), event handlers and callbacks that "remember" data, `debounce`/`throttle`, and the way React hooks capture props/state on each render.
- Pitfalls: **stale closures** (a callback keeps an old value) and memory leaks (a long-lived listener keeps a large object alive).

```js
function makeCounter() {
  let count = 0;            // private: nothing outside can touch it directly
  return () => ++count;     // the arrow function "closes over" count
}
const next = makeCounter();
next(); // 1
next(); // 2 -> count survived after makeCounter() returned
```

## Real-life example: the problem
Imagine an e-commerce product page with a search box that suggests products while the user types. The developer wrote a `debounce` helper so the API is called only after the user stops typing for 300 ms. Users reported that suggestions still flickered and the network tab showed one request **per keystroke**. The debounce was doing nothing.

The bug: the `timerId` variable is created **inside** the returned function, so every keystroke gets a brand-new `timerId`. `clearTimeout` clears nothing.

```js
// BROKEN: debounce.js
export function debounce(fn, delay) {
  return function (...args) {
    let timerId;                      // new variable on EVERY call
    clearTimeout(timerId);            // always clears undefined
    timerId = setTimeout(() => fn(...args), delay);
  };
}

// search.js
const input = document.querySelector('#search');

async function fetchSuggestions(query) {
  const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`);
  renderSuggestions(await res.json());
}

input.addEventListener('input', debounce((e) => {
  fetchSuggestions(e.target.value);
}, 300));
// Typing "laptop" fires 6 requests.
```

## How to fix it
Move `timerId` into the **outer** function so that every call to the returned function shares the same variable through the closure.

```js
// FIXED: debounce.js
export function debounce(fn, delay) {
  let timerId;                        // created once, shared by all calls

  return function (...args) {
    clearTimeout(timerId);            // clears the previous pending call
    timerId = setTimeout(() => {
      fn.apply(this, args);           // keep `this` for method use
    }, delay);
  };
}

// search.js (unchanged)
input.addEventListener('input', debounce((e) => {
  fetchSuggestions(e.target.value);
}, 300));
// Typing "laptop" fires 1 request, 300 ms after the last key.
```

Why it works: `debounce` runs **once** and creates one `timerId`. The returned function is a closure over that single variable, so each keystroke can cancel the timer set by the previous keystroke. The variable is private: no other code can reset or break it.

Same idea for private state, a function factory:

```js
function makePriceFormatter(currency) {
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency });
  return (amount) => fmt.format(amount); // remembers fmt and currency
}
const toEUR = makePriceFormatter('EUR');
toEUR(19.9); // "€19.90"
```

Alternatives: a class with a private field (`#timerId`) does the same job. In React, you would usually keep the timer in a `useRef` so it survives re-renders.

## How to say it in the interview
- "A closure is a function that remembers the variables of the scope where it was defined, even after that scope has finished running. It holds a reference, not a copy."
- Give one practical use right away: private state (counter, cache) or `debounce`. Interviewers like a real use more than a definition.
- Common follow-up: the `var` in a `for` loop with `setTimeout` puzzle. All callbacks close over the same `i`, so you get the final value. Fix with `let` (new binding per iteration) or an IIFE.
- Trade-off: closures keep their scope alive. A long-lived event listener that closes over a big object can cause a memory leak, so remove listeners you no longer need. In React, watch for **stale closures** in `useEffect` and `setInterval` callbacks.
