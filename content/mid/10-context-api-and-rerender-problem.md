# How do you use the Context API for global state, and why does one update re-render every consumer?

**Level:** Mid
**Merged from (original phrasings):**
- How do you implement context API for global state management?
- Why does one context update re-render every consumer? How do you fix it?

## The concept (short answer)
- Context passes a value down the tree without prop drilling: `createContext` -> `<Ctx value={...}>` (React 19; `<Ctx.Provider>` in older versions) -> `useContext(Ctx)` or `use(Ctx)`.
- It is a **dependency-injection mechanism, not a state manager**. You combine it with `useState`/`useReducer` in a provider component.
- When the provider's `value` changes (by `Object.is`), **every component that reads that context re-renders**, even if it only uses one field that didn't change. There are no selectors. `memo` on the consumer does not stop it.
- Two common causes of extra renders:
  1. The value is a **new object every render** (`value={{ user, setUser }}`), so all consumers re-render whenever the provider's parent re-renders.
  2. **One big context** holds unrelated, fast-changing data (cart + user + theme + notifications).
- Fixes: `useMemo` the value, **split contexts** by how often they change, **separate state from actions** (dispatch/setters are stable), keep providers close to where they're used. For large, frequently-updated global state, use a store with selectors (**Zustand**, Redux Toolkit, Jotai) or `useSyncExternalStore`.
- Good fits for context: theme, locale, current user, feature flags. Rarely-changing values.

## Real-life example: the problem
A food-delivery web app keeps everything in one `AppContext`: user, cart, theme and a live courier ETA updated every second. On the restaurant page with 200 menu items, every item reads the context only to know whether the user is logged in. The page stutters every second and scrolling feels janky on mid-range phones. The Profiler shows all 200 `MenuItem`s re-rendering once per second.

```jsx
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);
  const [eta, setEta] = useState(null);

  useEffect(() => {
    const id = setInterval(async () => setEta(await fetchEta()), 1000);
    return () => clearInterval(id);
  }, []);

  const addToCart = (item) => setCart((c) => [...c, item]);

  return (
    <AppContext.Provider value={{ user, setUser, cart, addToCart, eta }}>
      {children}
    </AppContext.Provider>
  );
}

const MenuItem = memo(function MenuItem({ dish }) {
  const { user, addToCart } = useContext(AppContext); // re-renders on every ETA tick
  return <button disabled={!user} onClick={() => addToCart(dish)}>{dish.name}</button>;
});
```

## How to fix it
Split by update frequency and separate stable actions from changing state.

```jsx
const UserContext = createContext(null);
const CartStateContext = createContext([]);
const CartActionsContext = createContext(null);
const EtaContext = createContext(null);

export function AppProviders({ children }) {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);

  const userValue = useMemo(() => ({ user, setUser }), [user]);
  const cartActions = useMemo(() => ({
    add: (item) => setCart((c) => [...c, item]),
    remove: (id) => setCart((c) => c.filter((i) => i.id !== id)),
  }), []); // setters are stable, so this object never changes

  return (
    <UserContext value={userValue}>
      <CartActionsContext value={cartActions}>
        <CartStateContext value={cart}>
          <EtaProvider>{children}</EtaProvider>
        </CartStateContext>
      </CartActionsContext>
    </UserContext>
  );
}

function EtaProvider({ children }) {
  const [eta, setEta] = useState(null); // fast state isolated in its own provider
  useEffect(() => {
    const id = setInterval(async () => setEta(await fetchEta()), 1000);
    return () => clearInterval(id);
  }, []);
  return <EtaContext value={eta}>{children}</EtaContext>;
}

// Custom hooks give a clear API and a helpful error
export function useCartActions() {
  const ctx = useContext(CartActionsContext);
  if (!ctx) throw new Error('useCartActions must be used inside AppProviders');
  return ctx;
}

const MenuItem = memo(function MenuItem({ dish }) {
  const { user } = useContext(UserContext);   // changes only on login/logout
  const { add } = useCartActions();            // never changes
  return <button disabled={!user} onClick={() => add(dish)}>{dish.name}</button>;
});
```
Why it works: the ETA tick only updates `EtaContext`, which only the courier banner reads. `children` is created higher up, so `EtaProvider` re-rendering does not re-render the menu. Adding to the cart updates `CartStateContext`, but menu items only read `CartActionsContext`, which is stable. Each consumer re-renders only when the data it reads changes.

Alternative for complex, frequently-updated state: a Zustand store with selectors re-renders only components whose selected slice changed:
```js
const user = useAppStore((s) => s.user);
const add = useAppStore((s) => s.addToCart);
```

## How to say it in the interview
- "Context is a way to pass a value, not a store. When the value changes, every consumer re-renders, with no selectors, and `memo` doesn't block it."
- "I fix it by memoizing the value, splitting contexts by update frequency, and putting actions in their own context. For high-frequency global state I use Zustand or Redux with selectors."
- Trap: `value={{ a, b }}` inline creates a new object on every render of the provider, so every consumer re-renders even if `a` and `b` didn't change.
- Trade-off: many small contexts mean more providers and boilerplate. An external store adds a dependency but gives fine-grained subscriptions.
