import { createContext, memo, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Badge, Browser, Button, Code, Note, Row, Stack } from '../../demo-kit';

export const scenario =
  'A food-delivery app shows a restaurant menu, a cart badge and a live courier ETA. App data (user, cart, ETA) is shared through context.';
export const task = 'Click "Add" on a dish, then turn on live ETA for a few seconds. Watch the render counters on every menu item.';
export const solutionNote = 'Same app, but user, cart state, cart actions and ETA live in separate contexts with memoized values.';

interface Dish {
  id: number;
  name: string;
  price: number;
}
const MENU: Dish[] = [
  { id: 1, name: 'Margherita', price: 9 },
  { id: 2, name: 'Diavola', price: 11 },
  { id: 3, name: 'Quattro formaggi', price: 12 },
  { id: 4, name: 'Tiramisu', price: 6 },
  { id: 5, name: 'Lemonade', price: 3 },
  { id: 6, name: 'Garlic bread', price: 4 },
];
type User = { name: string } | null;
interface Eta {
  minutes: number;
  live: boolean;
  setLive: (v: boolean) => void;
}

/* ---- the buggy version: one big context ---- */
interface AppValue {
  user: User;
  setUser: (u: User) => void;
  cart: Dish[];
  addToCart: (d: Dish) => void;
  eta: Eta;
}
const AppContext = createContext<AppValue | null>(null);

/* ---- the fixed version: split by what changes together ---- */
const UserContext = createContext<{ user: User; setUser: (u: User) => void } | null>(null);
const CartStateContext = createContext<Dish[]>([]);
const CartActionsContext = createContext<{ add: (d: Dish) => void } | null>(null);
const EtaContext = createContext<Eta | null>(null);

function useEtaTicker() {
  const [minutes, setMinutes] = useState(18);
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setMinutes((m) => (m <= 1 ? 18 : m - 1)), 1000);
    return () => clearInterval(id);
  }, [live]);
  return { minutes, live, setLive };
}

function BigAppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>({ name: 'Sam' });
  const [cart, setCart] = useState<Dish[]>([]);
  const eta = useEtaTicker();
  const addToCart = (d: Dish) => setCart((c) => [...c, d]);
  return <AppContext.Provider value={{ user, setUser, cart, addToCart, eta }}>{children}</AppContext.Provider>;
}

function EtaProvider({ children }: { children: ReactNode }) {
  const { minutes, live, setLive } = useEtaTicker(); // fast state isolated here
  const value = useMemo(() => ({ minutes, live, setLive }), [minutes, live]);
  return <EtaContext.Provider value={value}>{children}</EtaContext.Provider>;
}

function SplitProviders({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>({ name: 'Sam' });
  const [cart, setCart] = useState<Dish[]>([]);
  const userValue = useMemo(() => ({ user, setUser }), [user]);
  const cartActions = useMemo(() => ({ add: (d: Dish) => setCart((c) => [...c, d]) }), []); // never changes
  return (
    <UserContext.Provider value={userValue}>
      <CartActionsContext.Provider value={cartActions}>
        <CartStateContext.Provider value={cart}>
          <EtaProvider>{children}</EtaProvider>
        </CartStateContext.Provider>
      </CartActionsContext.Provider>
    </UserContext.Provider>
  );
}

/* Hooks: each component subscribes ONLY to the contexts that are actually provided in its version. */
const Fixed = createContext(false);
const useUser = () => {
  const f = useContext(Fixed);
  const app = useContext(AppContext);
  const u = useContext(UserContext);
  return f ? u! : { user: app!.user, setUser: app!.setUser };
};
const useAdd = () => {
  const f = useContext(Fixed);
  const app = useContext(AppContext);
  const a = useContext(CartActionsContext);
  return f ? a!.add : app!.addToCart;
};
const useCart = () => {
  const f = useContext(Fixed);
  const app = useContext(AppContext);
  const c = useContext(CartStateContext);
  return f ? c : app!.cart;
};
const useEta = () => {
  const f = useContext(Fixed);
  const app = useContext(AppContext);
  const e = useContext(EtaContext);
  return f ? e! : app!.eta;
};

const FLASH_CSS = '@keyframes m10-flash { from { background-color: var(--warn-soft); } to { background-color: transparent; } }';
function Renders() {
  const r = useRef(0);
  const n = ++r.current;
  return (
    <span
      key={n}
      style={{
        animation: n > 1 ? 'm10-flash 500ms ease-out' : undefined,
        borderRadius: 6,
        padding: '1px 6px',
        font: '600 11px var(--font-mono)',
        color: n > 1 ? 'var(--warn)' : 'var(--ink-3)',
      }}
    >
      renders: {n}
    </span>
  );
}

const MenuItem = memo(function MenuItem({ dish }: { dish: Dish }) {
  const { user } = useUser(); // only needs: is someone logged in?
  const add = useAdd();
  return (
    <Row gap={8} wrap={false} style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
      <span style={{ flex: '1 1 auto', fontSize: 14 }}>
        {dish.name} <span style={{ color: 'var(--ink-3)' }}>€{dish.price}</span>
      </span>
      <Renders />
      <Button disabled={!user} onClick={() => add(dish)} style={{ padding: '4px 10px' }}>
        Add
      </Button>
    </Row>
  );
});

function Header() {
  const { user, setUser } = useUser();
  const cart = useCart();
  return (
    <Row gap={8}>
      <strong style={{ flex: '1 1 auto' }}>Luigi's Pizzeria</strong>
      <Badge tone={cart.length ? 'info' : 'neutral'}>🛒 {cart.length}</Badge>
      <Button tone="ghost" onClick={() => setUser(user ? null : { name: 'Sam' })}>
        {user ? 'Log out' : 'Log in'}
      </Button>
    </Row>
  );
}

function EtaBanner() {
  const { minutes, live, setLive } = useEta();
  return (
    <Row gap={8}>
      <Badge tone={live ? 'good' : 'neutral'}>Courier ETA: {minutes} min</Badge>
      <Button onClick={() => setLive(!live)}>{live ? 'Stop live ETA' : 'Live ETA (1 update/s)'}</Button>
      <Renders />
    </Row>
  );
}

// Created once, outside the providers, so provider re-renders don't re-create it.
const PAGE = (
  <Stack gap={10}>
    <Header />
    <EtaBanner />
    <div>
      {MENU.map((d) => (
        <MenuItem key={d.id} dish={d} />
      ))}
    </div>
  </Stack>
);

function App({ fixed }: { fixed: boolean }) {
  const [key, setKey] = useState(0);
  return (
    <Stack gap={12}>
      <style>{FLASH_CSS}</style>
      <Fixed.Provider value={fixed}>
        <Browser url="eats.example/r/luigis-pizzeria">
          {fixed ? <SplitProviders key={key}>{PAGE}</SplitProviders> : <BigAppProvider key={key}>{PAGE}</BigAppProvider>}
        </Browser>
      </Fixed.Provider>
      <Row>
        <Button tone="ghost" onClick={() => setKey((k) => k + 1)}>
          Reset
        </Button>
      </Row>
      <Note>Menu items are wrapped in memo and get the same props every time.</Note>
      <Code>
        {fixed
          ? `const { user } = useContext(UserContext);     // login/logout only\nconst { add } = useContext(CartActionsContext); // never changes\n// cart → CartStateContext, ETA → EtaContext`
          : `<AppContext.Provider value={{ user, setUser, cart, addToCart, eta }}>\n\nconst { user, addToCart } = useContext(AppContext); // in MenuItem`}
      </Code>
    </Stack>
  );
}

export function Problem() {
  return <App fixed={false} />;
}

export function Solution() {
  return <App fixed />;
}
