# From setState to Pixels: React Updates and the Browser Rendering Pipeline

**Level:** Senior
**Merged from (original phrasings):**
- Walk through everything between setState and the pixels changing.
- Explain the browser rendering pipeline: DOM, CSSOM, layout, paint, and compositing.

## The concept (short answer)

**React side**
1. **Schedule:** `setState` does not render. It enqueues an update on the component's fiber, assigns it a **lane** (sync for a click, transition for `startTransition`, ...) and schedules the root. Updates in the same tick are **batched** (React 18: everywhere, including promises and timeouts).
2. **Render phase:** React calls your components, reconciles new elements against the current fiber tree, and flags what changed. Pure, no DOM touched, interruptible for non-urgent lanes.
3. **Commit phase (synchronous):** DOM mutations (insert/update/remove nodes), refs attached, then **`useLayoutEffect`** runs - after DOM writes but *before* the browser paints (reading layout here forces a synchronous layout).
4. **`useEffect`** runs after the browser has had a chance to paint (passive effects), so it does not block the frame. (React 18 flushes them synchronously for discrete inputs like clicks.)

**Browser side** (once JS yields the main thread)
1. **Parse:** HTML -> **DOM**, CSS -> **CSSOM**.
2. **Style recalc:** match selectors, compute styles for each element (render tree = visible nodes + computed styles).
3. **Layout (reflow):** compute geometry - size and position of every box.
4. **Paint:** record draw commands (text, colors, borders, shadows) into layers.
5. **Composite:** the compositor thread (GPU) assembles the layers into the final frame.

Key consequences: changing `width`/`top`/`font-size` triggers layout + paint + composite; changing `color`/`background` triggers paint + composite; changing **`transform`/`opacity`** on a promoted layer is **composite only** and can run on the compositor thread even while the main thread is busy. And **reading** a layout property (`offsetHeight`, `getBoundingClientRect`, `scrollTop`) after a **write** forces the browser to run style+layout synchronously right now - **forced synchronous layout**; doing it in a loop is **layout thrashing**.

## Real-life example: the problem

A project-management Kanban board. Each column equalizes card heights so rows line up, and the side drawer slides in by animating `left`. With 300 cards, opening a board freezes for ~800ms on a laptop and several seconds on mid-range phones; the drawer animation stutters. The Performance panel shows a long purple "Layout" stripe repeated hundreds of times with the warning "Forced reflow is a likely performance bottleneck".

```jsx
function Column({ cards }) {
  const listRef = useRef(null);

  useLayoutEffect(() => {
    const nodes = listRef.current.querySelectorAll('.card');
    let max = 0;
    nodes.forEach((node) => {
      node.style.height = 'auto';                 // WRITE  (invalidates layout)
      max = Math.max(max, node.offsetHeight);     // READ   (forces layout NOW)
      node.style.height = `${max}px`;             // WRITE  (invalidates again)
    });
  }, [cards]);

  return <ul ref={listRef}>{cards.map((c) => <li className="card" key={c.id}>{c.title}</li>)}</ul>;
}
```

```css
/* Animating a layout property: layout + paint on every frame, on the main thread */
.drawer { position: fixed; top: 0; left: -400px; width: 400px; transition: left 300ms; }
.drawer.open { left: 0; }
```

Every iteration interleaves write -> read, so the browser recomputes layout for the whole column 300 times instead of once. And because `left` is a layout property, each animation frame needs layout + paint on the main thread - which is exactly what is busy.

## How to fix it

Batch all **reads** first, then all **writes** (one layout instead of N), and animate only compositor-friendly properties.

```jsx
function Column({ cards }) {
  const listRef = useRef(null);

  useLayoutEffect(() => {
    const nodes = [...listRef.current.querySelectorAll('.card')];
    nodes.forEach((n) => { n.style.height = 'auto'; });     // all writes
    const heights = nodes.map((n) => n.offsetHeight);      // one forced layout, then cached reads
    const max = Math.max(...heights);
    nodes.forEach((n) => { n.style.height = `${max}px`; }); // all writes
  }, [cards]);

  return <ul ref={listRef}>{cards.map((c) => <li className="card" key={c.id}>{c.title}</li>)}</ul>;
}
```

Even better, delete the JS: CSS grid with `grid-auto-rows: 1fr` equalizes rows with zero script and no forced layout.

```css
.drawer {
  position: fixed; top: 0; left: 0; width: 400px;
  transform: translateX(-100%);
  transition: transform 300ms ease-out;
  will-change: transform; /* promote to its own layer; use sparingly, layers cost memory */
}
.drawer.open { transform: translateX(0); }
```

Why it works: the read/write batching means the layout is calculated once per pass. `transform` is applied by the compositor to an already-painted layer, so the slide stays at 60fps even if React is busy rendering the drawer's content. For complex DOM read/write coordination across components, schedule reads in one `requestAnimationFrame` and writes in the next (the fastdom pattern), or use `ResizeObserver` instead of polling sizes.

## How to say it in the interview

- "setState only schedules; React renders and diffs in a pure, interruptible phase, commits DOM mutations synchronously, runs layout effects before paint and passive effects after. Then the browser does style, layout, paint and composite."
- "The cheapest change is one the compositor can do alone: transform and opacity. Anything touching geometry pays for layout and paint."
- Trap: `useLayoutEffect` that reads layout is a forced synchronous layout - fine once, deadly in a loop. Follow-up: "Why does `useLayoutEffect` exist?" - to measure and fix up before paint to avoid a visible flicker (tooltips, popover positioning).
- Trade-off: `will-change` / layer promotion makes animation smooth but each layer costs GPU memory; promoting hundreds of elements can make low-end phones slower, not faster.
