# What is the difference between var, let, and const (and why does var break a for loop with setTimeout)?

**Level:** Junior
**Merged from (original phrasings):**
- What is the difference between "var", "let", and "const"?
- Explain the difference between var, let, and const in JavaScript.
- What happens when using "var" inside a "for" loop with "setTimeout()"?
- Coding question: `for (var i = 0; i < 3; i++) { setTimeout(() => { console.log(i); }); }` What is the output? Why? How can you fix it using let or a closure?

## The concept (short answer)

| | `var` | `let` | `const` |
|---|---|---|---|
| Scope | function | block `{ }` | block `{ }` |
| Hoisting | hoisted, initialized to `undefined` | hoisted, but in the **Temporal Dead Zone (TDZ)** until its line runs | same as `let` |
| Re-declare in same scope | yes | no (SyntaxError) | no |
| Re-assign | yes | yes | **no** |
| Global property (`window.x`) | yes, at top level | no | no |

- `const` blocks **re-assignment**, not mutation: `const cart = []; cart.push(item)` is fine.
- Using `let`/`const` before the declaration line throws `ReferenceError` (TDZ). Using `var` before it gives `undefined`, which hides bugs.
- Modern rule: use `const` by default, `let` when you must re-assign, avoid `var`.

### The coding question

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => {
    console.log(i);
  });
}
```

**Output:** `3`, `3`, `3`.

**Why:**
1. `var` is function-scoped, so there is only **one** `i` shared by the whole loop.
2. `setTimeout` puts each callback in the task queue. They run only after the current synchronous code (the whole loop) finishes, even with a delay of 0.
3. When the loop ends, `i` is `3` (that is the value that made `i < 3` false).
4. All three callbacks are closures over the **same** `i`, so all print `3`.

**Fix 1: use `let` (best).** `let` in a `for` header creates a **new binding for each iteration**, so each callback closes over its own `i`.

```js
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i)); // 0, 1, 2
}
```

**Fix 2: closure with an IIFE (the pre-ES6 way).** The function call creates a new scope with its own copy `j`.

```js
for (var i = 0; i < 3; i++) {
  (function (j) {
    setTimeout(() => console.log(j)); // 0, 1, 2
  })(i);
}
```

**Fix 3: pass the value as an argument to `setTimeout`.** Extra args are passed to the callback.

```js
for (var i = 0; i < 3; i++) {
  setTimeout((j) => console.log(j), 0, i); // 0, 1, 2
}
```

## Real-life example: the problem
Imagine a food-delivery app that shows a "Your order is being prepared" screen with 3 steps (Received, Cooking, On the way). Each step should light up one after another, every second. In production, nothing animated for 3 seconds and then the page threw `TypeError: Cannot read properties of undefined (reading 'classList')` three times. The step indicators stayed grey.

```js
// BROKEN
const steps = document.querySelectorAll('.order-step'); // 3 elements

for (var i = 0; i < steps.length; i++) {
  setTimeout(() => {
    steps[i].classList.add('active'); // i is 3 here -> steps[3] is undefined
  }, (i + 1) * 1000);
}
```

Note: the delays are correct (1s, 2s, 3s) because `(i + 1) * 1000` is computed **during** the loop. Only the code **inside** the callback reads `i` later, after the loop finished.

## How to fix it

```js
// FIXED
const steps = document.querySelectorAll('.order-step');

for (let i = 0; i < steps.length; i++) {
  setTimeout(() => {
    steps[i].classList.add('active'); // each callback has its own i: 0, 1, 2
  }, (i + 1) * 1000);
}

// Also good: forEach gives each callback its own parameter
steps.forEach((step, index) => {
  setTimeout(() => step.classList.add('active'), (index + 1) * 1000);
});
```

Why it works: with `let`, the loop creates a fresh `i` for each iteration, and each arrow function closes over its own copy. `forEach` works too because each call of the callback has its own `step` and `index` parameters.

Another `const` trap worth knowing:

```js
const user = { name: 'Ana' };
user.name = 'Bob';   // OK: mutating the object
user = {};           // TypeError: Assignment to constant variable.
// Use Object.freeze(user) if you really need it immutable (shallow only).
```

## How to say it in the interview
- "`var` is function-scoped and hoisted as `undefined`; `let` and `const` are block-scoped and live in the Temporal Dead Zone until declared. `const` prevents re-assignment, not mutation."
- For the loop: "It prints 3, 3, 3 because there is one shared `i` and the callbacks run after the loop. `let` creates a new binding per iteration, so it prints 0, 1, 2. Before ES6 we used an IIFE to create a new scope."
- Trap: saying "`setTimeout` with 0 ms runs immediately". It does not. It runs after the current call stack is empty (event loop).
- Trade-off/practice: default to `const` because it signals intent and prevents accidental re-assignment. Use `let` for counters and values that change. Linters (`no-var`, `prefer-const`) enforce this.
