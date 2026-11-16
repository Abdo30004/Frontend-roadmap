# How do you debug JavaScript and React applications effectively?

**Level:** Junior
**Merged from (original phrasings):**
- How do you debug JavaScript and React applications effectively?

## The concept (short answer)
- Debugging is a process, not random `console.log`s: **reproduce** the bug reliably, **isolate** where it happens, form a **hypothesis**, **verify** with tools, fix, then add a test so it does not come back.
- **Browser DevTools** are the main toolbox:
  - **Console**: errors and stack traces, `console.table`, `console.trace`, live expressions.
  - **Sources**: breakpoints, conditional breakpoints, logpoints, `debugger;` statement, step over/into, watch variables, call stack. Source maps map minified code back to your files.
  - **Network**: status codes, request payloads, response bodies, timing, throttling ("Slow 4G"), "Disable cache".
  - **Elements/Application**: DOM, computed CSS, localStorage, cookies; **Performance** for slow renders.
- **React DevTools**: Components tab to inspect props, state and hooks of any component; Profiler to see which components re-render and why ("Highlight updates when components render").
- React-specific helpers: StrictMode (double-invokes effects in dev to expose missing cleanup), the eslint `react-hooks/exhaustive-deps` rule, error boundaries, and readable error messages in dev builds.
- In production: error monitoring (Sentry etc.) with source maps uploaded, plus `git bisect` to find which commit introduced a regression.

## Real-life example: the problem
A typical case: in a customer support dashboard, when an agent clicks quickly from ticket #101 to ticket #102, the panel sometimes shows ticket #101's messages under #102's header. Agents replied to the wrong customer. A junior developer added `console.log`s everywhere, saw "the right ID is passed", and could not reproduce the bug on their fast office network.

```jsx
function TicketPanel({ ticketId }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    console.log("loading", ticketId);
    fetch(`/api/tickets/${ticketId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        console.log("got data");
        setMessages(data);       // whichever response arrives LAST wins
      });
  }, [ticketId]);

  return (
    <section>
      <h2>Ticket #{ticketId}</h2>
      {messages.map((m) => <Message key={m.id} {...m} />)}
    </section>
  );
}
```

## How to fix it
The debugging steps that find the cause:
1. **Reproduce**: DevTools Network tab -> throttle to "Slow 4G", click #101 then quickly #102. Now it fails every time.
2. **Observe**: the Network tab shows two requests in flight; the #101 request finishes after the #102 request.
3. **Verify**: put a logpoint (right-click line number -> "Add logpoint") on `setMessages` with `ticketId, data[0]?.ticketId`; it prints `102, 101`. React DevTools shows `ticketId: 102` but `messages` belonging to 101.
4. **Hypothesis confirmed**: a race condition; the effect never cancels the stale request.

The fix: abort the previous request in the effect cleanup.

```jsx
function TicketPanel({ ticketId }) {
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(`/api/tickets/${ticketId}/messages`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setMessages)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err);  // ignore our own cancellation
      });

    return () => controller.abort();  // runs when ticketId changes or on unmount
  }, [ticketId]);

  if (error) return <p role="alert">Could not load messages.</p>;
  return (
    <section>
      <h2>Ticket #{ticketId}</h2>
      {messages.map((m) => <Message key={m.id} {...m} />)}
    </section>
  );
}
```

Why it works: when `ticketId` changes, React runs the cleanup of the previous effect first, which aborts the old request, so a late response for #101 can never call `setMessages`. Also note the original code never checked `res.ok`, so a 500 error would have crashed on `.map` of an error object; that is fixed too.

Then lock it in with a regression test (RTL + a mocked delayed fetch) so it stays fixed.

Alternatives: a data library like TanStack Query or SWR keys the cache by ticket ID and handles races, retries and caching for you; a simple `let ignore = false` flag in the effect cleanup also works if you cannot abort.

Other useful tools to mention:

```js
debugger;                          // pauses here when DevTools is open
console.table(rows);               // arrays of objects as a table
console.trace("who called me?");   // prints the call stack
// Conditional breakpoint expression in Sources: order.total < 0
```

## How to say it in the interview
- "I first reproduce the bug reliably, then narrow it down with DevTools: breakpoints and the call stack in Sources, the Network tab for API issues, and React DevTools to inspect props, state and re-renders. After the fix I add a test."
- Give a concrete story like the race condition above: throttling the network to reproduce, then fixing with an AbortController in the effect cleanup.
- Follow-up: "How do you debug production?" Error monitoring with uploaded source maps, logs with context (user, route, release), feature flags, and `git bisect` for regressions.
- Trade-off: `console.log` is quick for simple cases, but breakpoints let you inspect everything at once without editing and redeploying code; remove stray logs before merging (lint rule `no-console`).
