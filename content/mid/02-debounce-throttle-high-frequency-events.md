# Debounce, throttle, and keeping the UI responsive under high-frequency events

**Level:** Mid
**Merged from (original phrasings):**
- Explain Debouncing and Throttling with practical examples.
- Your UI receives thousands of events every second. How do you keep it responsive?

## The concept (short answer)
- **Debounce**: wait until events **stop** for N ms, then run once. Good for search-as-you-type, autosave, resize-end, form validation.
- **Throttle**: run **at most once every N ms** while events keep coming. Good for scroll position, infinite-scroll checks, drag, analytics pings.
- **rAF batching**: coalesce all updates within a frame and apply them once in `requestAnimationFrame`. It runs at the screen refresh rate, so you never do more DOM work than can be painted.
- **Buffer and flush**: for streams (WebSocket ticks, logs), push incoming messages into a plain array (cheap) and flush to state on a timer or rAF. One render per flush instead of one render per message.
- **Web Workers**: move parsing, sorting and aggregation off the main thread. Send only the small result back.
- Also: virtualize long lists, and use `useDeferredValue`/`startTransition` so urgent input stays responsive while expensive rendering is interruptible.

```js
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function throttle(fn, wait) {
  let last = 0, t;
  return (...args) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else {
      clearTimeout(t); // trailing call so the final value is not lost
      t = setTimeout(() => { last = Date.now(); fn(...args); }, remaining);
    }
  };
}
```

## Real-life example: the problem
A crypto trading dashboard receives about 2,000 price ticks per second over a WebSocket. Each tick calls `setPrices`, and the order book re-renders on every message. Users report that the "Buy" button reacts half a second late, typing in the amount field lags, and the fan spins up. The search box in the same app sends one API request per keystroke, and results flicker because older responses arrive late.

```jsx
function OrderBook() {
  const [prices, setPrices] = useState({});

  useEffect(() => {
    const ws = new WebSocket('wss://example.com/ticks');
    ws.onmessage = (e) => {
      const tick = JSON.parse(e.data);
      setPrices((p) => ({ ...p, [tick.symbol]: tick.price })); // 2,000 renders/s
    };
    return () => ws.close();
  }, []);

  return <PriceTable prices={prices} />;
}

function SymbolSearch() {
  const [results, setResults] = useState([]);
  return (
    <input
      onChange={async (e) => {
        const res = await fetch(`/api/symbols?q=${e.target.value}`); // 1 request per key
        setResults(await res.json());
      }}
    />
  );
}
```

## How to fix it
Buffer ticks and flush once per animation frame. Debounce the search.

```jsx
function OrderBook() {
  const [prices, setPrices] = useState({});

  useEffect(() => {
    const ws = new WebSocket('wss://example.com/ticks');
    let buffer = {};   // latest price per symbol, no React involved
    let frame = 0;

    const flush = () => {
      frame = 0;
      const batch = buffer;
      buffer = {};
      setPrices((p) => ({ ...p, ...batch })); // max ~60 renders/s
    };

    ws.onmessage = (e) => {
      const tick = JSON.parse(e.data);
      buffer[tick.symbol] = tick.price;          // newer tick overwrites older
      if (!frame) frame = requestAnimationFrame(flush);
    };

    return () => {
      ws.close();
      cancelAnimationFrame(frame);
    };
  }, []);

  return <PriceTable prices={prices} />;
}

function SymbolSearch() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debounced) return;
    const ctrl = new AbortController();
    fetch(`/api/symbols?q=${encodeURIComponent(debounced)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then(setResults)
      .catch((err) => { if (err.name !== 'AbortError') console.error(err); });
    return () => ctrl.abort(); // stale responses never overwrite new ones
  }, [debounced]);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```
Why it works: the WebSocket handler now does only O(1) work per message. React renders at most once per frame, with the latest price per symbol, so the main thread is free for clicks and typing. The search sends one request after the user pauses, and `AbortController` cancels outdated requests.

If JSON parsing or aggregation is itself heavy (thousands of messages/s with big payloads), open the WebSocket inside a **Web Worker**, aggregate there, and `postMessage` a compact snapshot every 100ms. Also virtualize the table if it has thousands of rows.

## How to say it in the interview
- "Debounce waits for silence, throttle sets a maximum rate. For visual updates I batch with `requestAnimationFrame`, because the screen can't show more than one frame per refresh anyway."
- "For a firehose of events, I decouple receiving from rendering: buffer in a plain variable, flush to state on a schedule, and move heavy parsing into a worker."
- Trap: creating the debounced function inside the component body without `useMemo`/`useRef`. A new debounce is created on every render, so it never actually debounces.
- Trade-off: debounce adds latency (the user waits 300ms). Throttle can drop intermediate values, so make sure the trailing call runs and the final state is correct.
