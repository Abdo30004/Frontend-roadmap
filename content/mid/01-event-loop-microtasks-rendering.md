# How does the JavaScript event loop work (tasks, microtasks, Promises, rendering)?

**Level:** Mid
**Merged from (original phrasings):**
- Explain the Event Loop in JavaScript.
- How does the event loop handle Promises, async/await, and rendering?

## The concept (short answer)
- JavaScript runs on **one thread** with one **call stack**. Long synchronous code blocks everything: clicks, timers and painting.
- The browser's event loop repeats this cycle:
  1. Take **one task** (macrotask) from a task queue: a `setTimeout` callback, a click handler, a `message` event, a network callback. Run it until the stack is empty.
  2. **Drain the whole microtask queue**: Promise `.then/.catch/.finally`, code after `await`, `queueMicrotask`, `MutationObserver`. Microtasks added during this step also run before moving on.
  3. **Maybe render** (about every 16.6ms at 60Hz): run `requestAnimationFrame` callbacks, then style, layout and paint.
- `async/await` is Promise sugar. Everything before the first `await` runs synchronously. The rest of the function is queued as a microtask once the awaited value settles.
- Why it matters: microtasks can **starve rendering**, because the browser cannot paint until the queue is empty. A long task (>50ms) causes visible jank and hurts INP.

### Output-ordering puzzle
```js
console.log('1 sync');

setTimeout(() => console.log('2 timeout'), 0);

requestAnimationFrame(() => console.log('3 rAF'));

Promise.resolve()
  .then(() => console.log('4 micro A'))
  .then(() => console.log('5 micro B'));

(async () => {
  console.log('6 async start');
  await null;
  console.log('7 after await');
})();

queueMicrotask(() => console.log('8 queueMicrotask'));

console.log('9 sync end');
```
Output:
```
1 sync
6 async start          <- the sync part of an async function runs right away
9 sync end
4 micro A              <- microtasks run in FIFO order
7 after await
8 queueMicrotask
5 micro B              <- chained .then was queued only when A finished
2 timeout              <- next task (usually before rAF, but not guaranteed)
3 rAF                  <- right before the next paint
```
`2 timeout` vs `3 rAF` depends on the frame timing. Microtasks always come before both.

## Real-life example: the problem
A logistics dashboard imports a 20,000-row CSV of shipments. The developer adds a progress bar and "yields" with `await Promise.resolve()` after every chunk, expecting the bar to move. Users see the tab freeze for 4 seconds with the bar stuck at 0%, then it jumps to 100%. Chrome shows the "Page unresponsive" dialog on slower laptops.

```js
async function importRows(rows, onProgress) {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    rows.slice(i, i + CHUNK).forEach(validateAndNormalize); // heavy CPU work
    onProgress(Math.round(((i + CHUNK) / rows.length) * 100)); // updates the DOM
    await Promise.resolve(); // BUG: this only queues a microtask
  }
}
```
Why it breaks: each `await Promise.resolve()` puts the rest of the loop in the **microtask queue**. The browser drains microtasks before rendering, so the whole loop is one long block. No paint happens and no clicks are handled until it ends.

## How to fix it
Yield to a **task** (macrotask) so the browser can render and handle input between chunks:

```js
// Prefer scheduler.yield() where supported; fall back to a macrotask.
function yieldToMain() {
  if (globalThis.scheduler?.yield) return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function importRows(rows, onProgress) {
  const CHUNK = 500;
  let deadline = performance.now() + 50; // keep each task under ~50ms

  for (let i = 0; i < rows.length; i += CHUNK) {
    rows.slice(i, i + CHUNK).forEach(validateAndNormalize);

    if (performance.now() >= deadline) {
      onProgress(Math.min(100, Math.round(((i + CHUNK) / rows.length) * 100)));
      await yieldToMain(); // ends the current task: render + input can run
      deadline = performance.now() + 50;
    }
  }
  onProgress(100);
}
```
Why it works: `setTimeout`/`scheduler.yield()` ends the current task. The event loop can then run the render step (the progress bar repaints) and handle pending clicks before the next chunk starts. `scheduler.yield()` is better than `setTimeout` because the continuation keeps priority and is not put behind other queued tasks or the 4ms nested timer clamp.

Alternatives: move the parsing to a **Web Worker** (the best option for truly heavy CPU work). For visual updates, use `requestAnimationFrame` so DOM writes happen once per frame.

## How to say it in the interview
- "One task runs, then **all** microtasks drain, then the browser may render. Promises and `await` continuations are microtasks, so they always run before the next `setTimeout` and before the next paint."
- Trap: "`await` makes my code non-blocking." It doesn't. It only defers code to a microtask. To let the browser paint you must yield a **task** (`setTimeout`, `MessageChannel`, `scheduler.yield()`) or move the work to a worker.
- Follow-up "where does `requestAnimationFrame` run?": in the render step, right before style/layout/paint. It is the right place for DOM writes for animations, and it is paused in background tabs.
- Trade-off: smaller chunks make the UI more responsive but the total job takes longer (scheduling overhead). A time budget per chunk (about 50ms) is a good balance.
