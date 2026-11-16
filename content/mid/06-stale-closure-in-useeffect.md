# A useEffect([]) callback reads a stale value. Why, and how do you fix it?

**Level:** Mid
**Merged from (original phrasings):**
- A useEffect([]) callback reads a stale value. Why, and how do you fix it?

## The concept (short answer)
- Every render of a function component is a **new function call** with its own props, state and functions. Closures created during that render **capture that render's values**.
- `useEffect(fn, [])` runs **only after the first render**. Any callback it registers (interval, event listener, WebSocket handler) keeps the closure from render #1 forever, so it sees the **initial** state and props. That is a stale closure.
- It is not a React bug. It is how JavaScript closures work combined with an empty dependency array that lies about what the effect uses.
- Fixes, from best to most specific:
  1. **Declare the real dependencies** (the effect re-subscribes when they change). Trust the `react-hooks/exhaustive-deps` lint rule.
  2. **Functional updater** `setX(prev => ...)` when you only need the previous state to compute the next one.
  3. **Ref with the latest value** (`latestRef.current = value`) when you need to read the current value without re-subscribing.
  4. `useEffectEvent` (stable in React 19.2): a function called from the effect that always sees the latest props/state but is not a dependency.

## Real-life example: the problem
A customer-support chat widget has a "notify me" toggle. When a new message arrives over the WebSocket, it should play a sound only if notifications are on and show the unread count. Users turn notifications **off**, but the sound keeps playing. The unread counter also gets stuck at 1 no matter how many messages arrive.

```jsx
function SupportChat({ ticketId }) {
  const [soundOn, setSoundOn] = useState(true);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const socket = connectToTicket(ticketId);
    socket.on('message', (msg) => {
      if (soundOn) playPing();       // always the initial value: true
      setUnread(unread + 1);          // always 0 + 1 = 1
    });
    return () => socket.disconnect();
  }, []); // BUG: uses soundOn, unread and ticketId but declares none

  return (
    <>
      <label>
        <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} />
        Sound
      </label>
      <Badge count={unread} />
    </>
  );
}
```
Three bugs from one empty array: stale `soundOn`, stale `unread`, and the socket does not reconnect when the user switches to another ticket.

## How to fix it
```jsx
import { useEffect, useEffectEvent, useState } from 'react';

function SupportChat({ ticketId }) {
  const [soundOn, setSoundOn] = useState(true);
  const [unread, setUnread] = useState(0);

  // Reads the LATEST soundOn, but is not a dependency of the effect
  const onMessage = useEffectEvent(() => {
    if (soundOn) playPing();
  });

  useEffect(() => {
    const socket = connectToTicket(ticketId);
    socket.on('message', () => {
      setUnread((n) => n + 1); // updater: no need to read unread
      onMessage();
    });
    return () => socket.disconnect();
  }, [ticketId]); // the only real reactive dependency: reconnect when the ticket changes

  // ...same JSX
}
```
Why it works:
- `setUnread(n => n + 1)` asks React for the current value, so the closure does not need `unread`.
- `useEffectEvent` gives a function that always reads the latest `soundOn`. Toggling sound does **not** reconnect the socket, which is correct: it is not a reason to reconnect.
- `ticketId` is a real dependency, so switching tickets runs the cleanup (disconnect) and connects to the new ticket.

### Without useEffectEvent (React 18 or older 19.x): the "latest ref" pattern
```jsx
const soundOnRef = useRef(soundOn);
useEffect(() => {
  soundOnRef.current = soundOn; // keep the ref in sync after each commit
}, [soundOn]);

useEffect(() => {
  const socket = connectToTicket(ticketId);
  socket.on('message', () => {
    setUnread((n) => n + 1);
    if (soundOnRef.current) playPing(); // refs are mutable, so always current
  });
  return () => socket.disconnect();
}, [ticketId]);
```
The simplest alternative is to add `soundOn` to the dependency array. It is correct, but it reconnects the socket on every toggle, which is wasteful here. For a cheap `setInterval`, adding the dependency is usually fine.

## How to say it in the interview
- "Each render has its own closure. An effect with `[]` only captures the first render's values, so callbacks it registers see stale state. The empty array is lying about the dependencies."
- "My order of fixes: correct dependencies, then a functional updater, then a ref or `useEffectEvent` for values I want to read but not react to."
- Trap: disabling the `exhaustive-deps` lint rule to "fix" the warning. That is exactly how stale closures get into production.
- Trade-off: more dependencies are correct but may cause re-subscribing. Refs avoid that but are not reactive, so changing a ref never triggers a render.
