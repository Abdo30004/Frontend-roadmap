# What is the difference between useEffect and useLayoutEffect?

**Level:** Mid
**Merged from (original phrasings):**
- What is the difference between "useEffect" and "useLayoutEffect"?

## The concept (short answer)
- Both run after React commits changes to the DOM. The difference is **when, relative to the browser paint**.
- `useLayoutEffect` runs **synchronously after DOM mutations and before the browser paints**. If you set state inside it, React re-renders synchronously, and the user only ever sees the final result. It blocks painting.
- `useEffect` runs **after the paint** (usually). The user can briefly see the first version of the UI before your effect changes it, which causes a flicker if the effect changes the layout.
- Rule: use `useEffect` by default (data fetching, subscriptions, logging, timers). Use `useLayoutEffect` only when you need to **measure the DOM and change it before the user sees it**: tooltip/popover positioning, scroll restoration, auto-sizing elements, keeping scroll anchored in a chat.
- Order in a commit: DOM updated -> layout effect cleanups + layout effects -> paint -> passive effect cleanups + effects.
- `useLayoutEffect` does nothing during server rendering (React 18 warned about it, React 19 no longer warns). The real issue is the same: the server HTML has no measurements, so measure-based UI must render a fallback first.
- `useInsertionEffect` exists for CSS-in-JS libraries to inject styles before layout effects. App code almost never needs it.

## Real-life example: the problem
On a SaaS analytics dashboard, hovering a chart data point shows a tooltip. If the tooltip would go off the right edge of the screen, it should flip to the left side. Users see the tooltip appear on the right for a split second, then jump to the left. QA calls it "the jumping tooltip"; it is very visible on slower machines.

```jsx
function Tooltip({ anchorRect, children }) {
  const ref = useRef(null);
  const [left, setLeft] = useState(anchorRect.right + 8);

  useEffect(() => {
    // BUG: runs after the browser already painted the tooltip at the old position
    const { width } = ref.current.getBoundingClientRect();
    if (anchorRect.right + 8 + width > window.innerWidth) {
      setLeft(anchorRect.left - width - 8);
    }
  }, [anchorRect]);

  return (
    <div ref={ref} className="tooltip" style={{ position: 'fixed', top: anchorRect.top, left }}>
      {children}
    </div>
  );
}
```
What happens: render 1 -> commit -> **paint (tooltip on the right, overflowing)** -> effect measures -> setLeft -> render 2 -> paint (tooltip on the left). The user sees two frames.

## How to fix it
```jsx
import { useLayoutEffect, useRef, useState } from 'react';

function Tooltip({ anchorRect, children }) {
  const ref = useRef(null);
  const [left, setLeft] = useState(anchorRect.right + 8);

  useLayoutEffect(() => {
    // Runs after DOM update, BEFORE paint. Re-render happens synchronously.
    const { width } = ref.current.getBoundingClientRect();
    const fitsRight = anchorRect.right + 8 + width <= window.innerWidth;
    setLeft(fitsRight ? anchorRect.right + 8 : anchorRect.left - width - 8);
  }, [anchorRect]);

  return (
    <div ref={ref} className="tooltip" style={{ position: 'fixed', top: anchorRect.top, left }}>
      {children}
    </div>
  );
}
```
Why it works: React runs the layout effect before the browser gets the chance to paint. The state update inside it is processed synchronously, so the first frame the user sees already has the correct position. No flicker.

Alternatives: for positioning specifically, use a library like Floating UI (it handles flip/shift/scroll), or CSS anchor positioning where browser support allows. For server-rendered pages, render the tooltip only on the client (it appears on hover anyway), so the server/client measurement issue does not happen.

### Second classic case: chat scroll anchoring
```jsx
useLayoutEffect(() => {
  const el = listRef.current;
  // keep the user at the bottom when new messages arrive, without a visible jump
  if (wasAtBottomRef.current) el.scrollTop = el.scrollHeight;
}, [messages]);
```

## How to say it in the interview
- "`useEffect` runs after paint and does not block it. `useLayoutEffect` runs after the DOM update but before paint, so I use it only to measure layout and fix it up without a flicker."
- Trap: putting data fetching or heavy logic in `useLayoutEffect`. It blocks painting, so the page feels slower. It should stay short.
- Follow-up "does `useEffect` always run after paint?": usually, but if the update came from a discrete user event (like a click) or a layout effect set state, React may flush passive effects before paint. Don't rely on `useEffect` timing for visual correctness.
- Trade-off: `useLayoutEffect` gives visual correctness at the cost of blocking the frame. With SSR it can't run on the server, so the first HTML may differ from the measured result.
