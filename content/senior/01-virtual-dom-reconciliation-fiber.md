# The Virtual DOM, Reconciliation and React Fiber

**Level:** Senior
**Merged from (original phrasings):**
- Explain the virtual DOM in React and how it improves performance.
- What happens during React reconciliation, and how does Fiber work?

## The concept (short answer)

**Start simple (the junior answer):**
- The "virtual DOM" is the tree of plain JS objects (React elements) your components return. It is cheap to create and throw away.
- On every update React builds a new tree, compares it with the previous one (**reconciliation**), and applies only the minimal set of real DOM mutations. The win is not "the virtual DOM is faster than the DOM" (it is pure overhead on top of the DOM); the win is that you write declarative "UI = f(state)" code and React batches and minimizes the expensive DOM writes for you.

**Go deep (the senior answer):**
- **Diffing heuristics (O(n) instead of O(n^3)):** (1) elements of a **different type** produce a different subtree - React unmounts the old one (state destroyed, effects cleaned up) and mounts a new one, without comparing children; (2) same type means React keeps the instance/DOM node and only updates props; (3) **keys** identify children in a list across renders, so React can move instead of recreate. Index keys break on reorder/insert (state sticks to the wrong row).
- **"Type" means identity:** `<A/>` vs `<B/>` at the same position, or a component defined inside another component (new function every render) is a new type each time, so it remounts.
- **Fiber** is the reimplementation of the reconciler (React 16). Each component instance gets a fiber node: a unit of work with `child` / `sibling` / `return` pointers, so React can walk the tree with a loop instead of recursion, **pause, resume, or abandon** work.
- **Double buffering:** the `current` tree is what is on screen; React builds a `workInProgress` tree (linked via `alternate`) and swaps them at commit.
- **Two phases:** the **render phase** (call components, diff, mark effect flags) is pure and, in concurrent rendering, **interruptible** - it can be restarted, so components must be pure. The **commit phase** (DOM mutations, refs, `useLayoutEffect`, then `useEffect`) is synchronous and never interrupted, so users never see a half-updated UI.
- **Priorities / lanes:** every update gets a lane (bitmask): `SyncLane` for discrete input like clicks, default lane, `TransitionLanes` for `startTransition`, idle lanes. The scheduler works in ~5ms time slices and yields to the browser; a high-priority update can interrupt an in-progress low-priority render.

## Real-life example: the problem

An insurance quote form. The user fills in name, address and car details, then ticks "Add premium coverage". The card around the form changes style - and **every field the user typed is wiped**. Support tickets: "the form deletes my data". Nobody touched the form's state; the reconciler did exactly what it was told.

```jsx
function QuoteForm() {
  const [values, setValues] = useState({ name: '', address: '', plate: '' });
  const update = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
  return (
    <>
      <input name="name" value={values.name} onChange={update} />
      <input name="address" value={values.address} onChange={update} />
      <input name="plate" value={values.plate} onChange={update} />
    </>
  );
}

function QuotePage() {
  const [premium, setPremium] = useState(false);

  // BUG 1: the parent type changes, so the whole subtree (and QuoteForm state) is remounted
  const Card = premium ? PremiumCard : BasicCard;

  // BUG 2: a component defined during render is a brand-new type on every render
  const PremiumToggle = () => (
    <input type="checkbox" checked={premium} onChange={(e) => setPremium(e.target.checked)} />
  );

  return (
    <Card>
      <QuoteForm />
      <PremiumToggle />
    </Card>
  );
}
```

What React sees on toggle: position 0 was `BasicCard`, now `PremiumCard` - different type, so it tears down `BasicCard` and everything under it, including the `QuoteForm` fiber and its `useState`. Bug 2 is subtler: `PremiumToggle` is a new function on every render of `QuotePage`, so the checkbox (and anything in it) remounts on every keystroke that re-renders the parent, losing focus.

## How to fix it

Keep the **tree shape and component types stable**; express the visual difference through props.

```jsx
function Card({ variant, children }) {
  return <section className={variant === 'premium' ? 'card card--premium' : 'card'}>{children}</section>;
}

// Defined at module level: stable identity across renders
function PremiumToggle({ checked, onChange }) {
  return <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />;
}

function QuotePage() {
  const [premium, setPremium] = useState(false);
  return (
    <Card variant={premium ? 'premium' : 'basic'}>
      <QuoteForm />
      <PremiumToggle checked={premium} onChange={setPremium} />
    </Card>
  );
}
```

Why it works: the element at each position now has the same type before and after the toggle, so React reuses the existing fibers and only patches the `className`. `QuoteForm`'s state lives on its fiber, which survives.

Alternatives: if the two layouts really must be different components, **lift the form state up** (or into a form library / URL) so it survives a remount. And use the same rule on purpose when you *want* a reset: `<QuoteForm key={customerId} />` throws away state when switching customers.

Keys in lists follow the same logic:

```jsx
// BAD: delete row 0 and row 1's typed note now shows in the wrong row
{drivers.map((d, i) => <DriverRow key={i} driver={d} />)}
// GOOD: identity follows the data
{drivers.map((d) => <DriverRow key={d.id} driver={d} />)}
```

## How to say it in the interview

- "The virtual DOM is not faster than the DOM; it lets React compute a minimal set of mutations from a declarative description. Reconciliation is an O(n) heuristic diff: different type means remount, same type means update, keys give identity to list items."
- "Fiber turns the component tree into a linked list of units of work. The render phase is interruptible and prioritized with lanes; the commit phase is synchronous so the UI is never half-applied."
- Trap / follow-up: "Why did my form state reset?" - a type change at that position (conditional wrapper, component declared inside render, changed `key`). Also: because render can run more than once and be discarded, side effects in render are bugs - that is why StrictMode double-invokes it.
- Trade-off: the heuristics trade optimal diffs for speed - React will not detect that a subtree "moved" to a different parent; it remounts it. Structure your tree so stable things stay at stable positions.
