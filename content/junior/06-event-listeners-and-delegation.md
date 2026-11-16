# What are event listeners, how do they work, and what is event delegation?

**Level:** Junior
**Merged from (original phrasings):**
- What are Event Listeners? How do they work?

## The concept (short answer)
- An **event listener** is a function you register on a DOM element with `element.addEventListener(type, handler, options)`. When the event happens (click, input, submit, keydown...), the browser calls the handler with an **event object**.
- An event travels in 3 phases: **capturing** (from `window` down to the target), **target**, then **bubbling** (from the target back up to `window`). Listeners run in the bubbling phase by default; pass `{ capture: true }` to run during capturing.
- `event.target` is the element that was actually clicked; `event.currentTarget` is the element the listener is attached to.
- `event.stopPropagation()` stops the event from moving further. `event.preventDefault()` cancels the browser's default action (form submit, link navigation). They are different things.
- **Event delegation:** because events bubble, you put **one** listener on a parent and use `event.target.closest(selector)` to find which child was clicked. It uses less memory and works for children added **later**.
- Remove listeners with `removeEventListener` (same function reference) or an `AbortController` signal. Useful options: `{ once: true }`, `{ passive: true }` for scroll/touch performance.

```js
button.addEventListener('click', (event) => {
  console.log(event.target, event.currentTarget);
});
```

## Real-life example: the problem
Imagine an email web app's inbox. Each row has a "Delete" button. The first 50 emails worked, but emails loaded by **infinite scroll** (or new mail that arrives live) had **dead Delete buttons**. Also, the page got slower over time: each "refresh" re-attached listeners, so some clicks fired the delete request **twice**.

```js
// BROKEN: inbox.js
const list = document.querySelector('#inbox');

function attachDeleteHandlers() {
  document.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      deleteEmail(btn.dataset.id);   // runs once per attached listener
    });
  });
}

renderEmails(list, firstPage);
attachDeleteHandlers();              // only existing buttons get a listener

async function loadMore() {
  const next = await fetchNextPage();
  appendEmails(list, next);          // new buttons: no listener -> dead
}

async function refresh() {
  renderEmails(list, await fetchFirstPage());
  attachDeleteHandlers();            // buttons that survived get a 2nd listener
}
```

## How to fix it
Use event delegation: a single listener on the list container handles clicks for all current and future rows.

```js
// FIXED: inbox.js
const list = document.querySelector('#inbox');

// one listener, attached once, for every row (now and later)
list.addEventListener('click', (event) => {
  // closest() works even if the user clicks the <svg> icon inside the button
  const deleteBtn = event.target.closest('.delete-btn');
  if (deleteBtn) {
    deleteEmail(deleteBtn.dataset.id);
    return;                          // don't also open the email
  }

  const row = event.target.closest('.email-row');
  if (row) openEmail(row.dataset.id);
});

renderEmails(list, firstPage);

async function loadMore() {
  appendEmails(list, await fetchNextPage()); // new rows work automatically
}

async function refresh() {
  renderEmails(list, await fetchFirstPage()); // no re-attaching, no duplicates
}
```

Why it works: clicks on any `.delete-btn` bubble up to `#inbox`, where one listener catches them. It is attached **once**, so there are no duplicate calls, and it does not care when the rows were created. Checking the delete button first and returning early means a click on "Delete" does not also open the email.

Note: `stopPropagation()` only stops the event from reaching **ancestors**; it does not stop other listeners on the same element. That is why one combined handler with early `return` is cleaner than two separate listeners on `#inbox`.

Cleaning up listeners (e.g. when a widget is destroyed):

```js
const controller = new AbortController();
window.addEventListener('resize', onResize, { signal: controller.signal });
window.addEventListener('scroll', onScroll, { passive: true, signal: controller.signal });
controller.abort(); // removes both
```

In React you rarely do this by hand: `onClick` props already use delegation at the root, and for `window`/`document` listeners you add them in `useEffect` and remove them in the cleanup.

## How to say it in the interview
- "An event goes down in the capturing phase, hits the target, then bubbles up. Listeners run in the bubbling phase by default, which is what makes event delegation possible."
- "With delegation I attach one listener to a parent and use `event.target.closest()` to find the item. It works for elements added later and avoids hundreds of listeners."
- Trap: `removeEventListener` needs the **same function reference**; an inline arrow function cannot be removed. Use a named function or `AbortController`.
- Trade-off: some events do not bubble (`focus`, `blur`, `mouseenter`); use `focusin`/`focusout` or `mouseover` for delegation. Overusing `stopPropagation` can break analytics or "click outside to close" logic higher up.
