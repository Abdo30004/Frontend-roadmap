# What causes memory leaks in React, and how do you debug them?

**Level:** Mid
**Merged from (original phrasings):**
- What causes memory leaks in React, and how do you debug them?

## The concept (short answer)
- A memory leak is memory that is **still reachable** (so the garbage collector can't free it) but no longer needed. In SPAs, leaks build up because the page is never reloaded: memory grows with every navigation until tabs become slow or crash.
- **Common causes in React:**
  - Effects that subscribe without cleanup: `window.addEventListener`, `setInterval`, WebSocket/EventSource, `ResizeObserver`/`IntersectionObserver`, store subscriptions, third-party widgets (maps, charts) never `.destroy()`ed.
  - **Closures** kept alive by those listeners: the callback references component state, props or large data, so all of it stays reachable.
  - **Detached DOM nodes:** a module-level variable, cache or third-party library still holds a reference to DOM elements React has already removed.
  - **Unbounded caches or module-level arrays/Maps** (memoization caches keyed by objects, a global `logs.push(...)`).
  - Async work that resolves after unmount and updates something global (this is not the old "setState on unmounted component" warning, which React 18 removed because that case is mostly harmless).
- **Fix pattern:** every effect that starts something returns a cleanup that stops it. Use `AbortController` for fetches, `WeakMap`/`WeakRef` or bounded LRU caches for object-keyed caches.
- **Debugging:** Chrome DevTools Memory tab. Take a heap snapshot, perform the suspect action (open/close a modal, navigate away and back) several times, force GC, take another snapshot, then use the **Comparison** view and filter for "Detached" to find detached DOM. The **Retainers** panel shows what is keeping an object alive. The Performance monitor ("JS heap size", "DOM Nodes", "JS event listeners") shows the trend over time.

## Real-life example: the problem
A trading dashboard is kept open all day by traders. After a few hours of switching between instruments, the tab uses 2.5 GB of RAM, charts stutter, and Chrome eventually shows "Aw, Snap!". The Performance monitor shows "JS event listeners" and "DOM Nodes" growing every time the user switches instruments. Heap snapshot comparison shows thousands of `Detached HTMLDivElement` and `Detached HTMLCanvasElement` objects retained by a `resize` listener closure and by the chart library's internal registry.

```jsx
const priceHistoryCache = {}; // module-level, grows forever

function PriceChart({ symbol }) {
  const containerRef = useRef(null);
  const [ticks, setTicks] = useState([]);

  useEffect(() => {
    const chart = createChart(containerRef.current);           // never destroyed
    const ws = new WebSocket(`wss://feed.example.com/${symbol}`); // never closed
    ws.onmessage = e => {
      const tick = JSON.parse(e.data);
      priceHistoryCache[symbol] = [...(priceHistoryCache[symbol] ?? []), tick]; // unbounded
      setTicks(t => [...t, tick]);
      chart.update(tick);
    };
    window.addEventListener('resize', () => chart.resize());   // anonymous: can't be removed
    setInterval(() => chart.redraw(), 1000);                   // never cleared
  }, [symbol]);

  return <div ref={containerRef} />;
}
```

Every symbol switch reruns the effect: a new chart, socket, listener and interval each time, and the old ones keep running. The old ones also keep the previous chart instance and its canvas (now detached) alive through their closures.

## How to fix it
```jsx
const MAX_TICKS = 5000;
const priceHistoryCache = new Map(); // bounded below; could also be an LRU

function PriceChart({ symbol }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const chart = createChart(containerRef.current);
    const ws = new WebSocket(`wss://feed.example.com/${symbol}`);

    ws.onmessage = e => {
      const tick = JSON.parse(e.data);
      const history = priceHistoryCache.get(symbol) ?? [];
      history.push(tick);
      if (history.length > MAX_TICKS) history.splice(0, history.length - MAX_TICKS);
      priceHistoryCache.set(symbol, history);
      chart.update(tick);             // chart owns the rendering; no React state per tick
    };

    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    const redrawId = setInterval(() => chart.redraw(), 1000);

    return () => {                    // runs on unmount AND before the effect reruns
      ws.close();
      window.removeEventListener('resize', onResize);
      clearInterval(redrawId);
      chart.destroy();                // releases canvas and library-internal references
    };
  }, [symbol]);

  return <div ref={containerRef} />;
}
```

Shortcut for multiple listeners: create an `AbortController` in the effect, pass `{ signal }` to every `addEventListener`, and call `controller.abort()` in the cleanup.

How to verify the fix:
1. DevTools, Memory tab, Heap snapshot (baseline).
2. Switch instruments 20 times, return to the first one, click the trash icon (force GC), take snapshot 2.
3. Comparison view: `Detached HTMLCanvasElement` and `WebSocket` counts should go back to baseline instead of growing by about 20.
4. Performance monitor: "JS event listeners" stays flat.

Why it works: each effect run now fully undoes itself, so nothing outside the component (window, timers, sockets, chart registry) holds a reference to old closures or DOM. Once unreachable, the old chart and canvas are garbage collected. The cache is capped, so long sessions use bounded memory.

Tip: React 18+ StrictMode in development mounts, unmounts and remounts components, which makes missing cleanups show up early (duplicate sockets, double listeners).

## How to say it in the interview
- "Most React leaks come from effects that start something (listener, timer, socket, observer, third-party instance) without a cleanup, and from long-lived references such as module caches or libraries holding detached DOM."
- "I debug with heap snapshot comparison: repeat the action, force GC, compare, filter 'Detached', and follow the retainers chain to the code holding the reference."
- Trap: "the setState on unmounted component warning means a leak." React 18 removed that warning. The real leak is the subscription that keeps running.
- Trade-off: caches improve speed but must be bounded (LRU, TTL, or `WeakMap` for object keys), otherwise they become the leak.
