# How does the useEffect cleanup function work, and why does unmounting matter?

**Level:** Mid
**Merged from (original phrasings):**
- How does the cleanup function in "useEffect" work?
- What is the purpose of the unmounting phase in React?

## The concept (short answer)
- The function you **return** from an effect is the cleanup. React calls it:
  1. **Before the effect runs again** because a dependency changed (cleanup with the *old* values, then the effect with the new ones).
  2. **When the component unmounts** (removed from the tree, route change, conditional render becomes false, `key` changes).
- Unmounting is the moment to **release everything the component started outside React**: timers, intervals, event listeners, WebSocket/SSE connections, subscriptions, in-flight fetches (`AbortController`), third-party widgets (maps, charts), observers.
- If you skip cleanup you get **memory leaks**, duplicated listeners, timers still firing, and network responses updating state for a component that is gone or that now shows different data.
- Think of each effect as a pair: **setup and cleanup must mirror each other**. If you `addEventListener`, you `removeEventListener` with the same function reference.
- **StrictMode (dev only)**: React 18+ mounts each component, then **immediately runs cleanup and the effect again** (mount -> unmount -> mount). This is on purpose: it reveals missing or wrong cleanup. If your app breaks or double-subscribes in dev, your cleanup is incomplete. It does not happen in production.

## Real-life example: the problem
In a ride-hailing app, the "Driver on the way" screen polls the driver's location every 3 seconds and listens to `visibilitychange` to pause polling when the tab is hidden. After users open and close the screen a few times (or switch between rides), the network tab shows 5-6 parallel polling loops, the battery drains, and sometimes the map shows the **previous** ride's driver, because an old interval is still writing into state.

```jsx
function DriverTracker({ rideId }) {
  const [position, setPosition] = useState(null);

  useEffect(() => {
    const id = setInterval(async () => {
      const res = await fetch(`/api/rides/${rideId}/driver-location`);
      setPosition(await res.json()); // may be for an old rideId
    }, 3000);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearInterval(id);
    });
    // BUG: no cleanup. Interval + listener live forever.
  }, [rideId]);

  return <DriverMap position={position} />;
}
```
In development with StrictMode, the bug shows up immediately: two intervals on first mount, because the effect runs twice and nothing is cleaned up.

## How to fix it
```jsx
function DriverTracker({ rideId }) {
  const [position, setPosition] = useState(null);

  useEffect(() => {
    let intervalId = null;
    let controller = null;

    const poll = async () => {
      controller?.abort();                 // cancel the previous request
      controller = new AbortController();
      try {
        const res = await fetch(`/api/rides/${rideId}/driver-location`, {
          signal: controller.signal,
        });
        setPosition(await res.json());
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
      }
    };

    const start = () => {
      if (intervalId === null) {
        poll();
        intervalId = setInterval(poll, 3000);
      }
    };
    const stop = () => {
      clearInterval(intervalId);
      intervalId = null;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener('visibilitychange', onVisibility);

    // Cleanup: runs before the next rideId and on unmount
    return () => {
      stop();
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibility); // same reference
    };
  }, [rideId]);

  return <DriverMap position={position} />;
}
```
Why it works: every resource the effect creates is released in the cleanup. When `rideId` changes, the old interval, old request and old listener are removed **before** the new ones start, so old data can't overwrite new data. On unmount, nothing keeps running. The StrictMode double-invoke now just starts, stops and starts again, which is harmless.

Alternatives: for polling server data, TanStack Query (`refetchInterval`, `refetchIntervalInBackground: false`) handles this lifecycle for you. For external stores, `useSyncExternalStore` handles subscribe/unsubscribe.

### Execution order to remember
```
mount:              render -> commit -> effect(rideId=1)
rideId changes:     render -> commit -> cleanup(rideId=1) -> effect(rideId=2)
unmount:            cleanup(rideId=2)
StrictMode (dev):   effect -> cleanup -> effect   (on first mount only)
```

## How to say it in the interview
- "The cleanup is the mirror of the setup. React runs it before re-running the effect and on unmount, so a component never leaves timers, listeners or requests behind."
- "StrictMode mounts, unmounts and mounts again in development. If that breaks something, the cleanup is missing. The fix is to write correct cleanup, not to add a `useRef` flag that skips the second run."
- Trap: `removeEventListener` with a new inline arrow function does nothing, because it is a different function reference.
- Trade-off/follow-up: not every effect needs cleanup (e.g. setting `document.title`), but anything that subscribes, schedules or fetches does.
