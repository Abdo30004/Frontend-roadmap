import { memo, useReducer, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Note, Panel, Resettable, Row, Stack, Stat } from '../../demo-kit';

export const scenario = 'A food-delivery cart: add dishes from the menu, the header badge counts them, and the cart shows the item count and total.';
export const task = 'Press "Add ×3" on the pizza, then "Add" on the ramen. Compare the badge, the rows, "Items" and "Total". Then remove a row.';
export const solutionNote = 'Same cart, but one reducer owns the items and count/total are derived from them.';

interface Dish { id: string; name: string; price: number }
interface Line extends Dish { qty: number; key: number }

const MENU: Dish[] = [
  { id: 'pizza', name: 'Margherita pizza', price: 11 },
  { id: 'ramen', name: 'Tonkotsu ramen', price: 14 },
];

// Header badge. memo: it only re-renders when it gets a NEW `items` array.
const CartBadge = memo(function CartBadge({ items }: { items: Line[] }) {
  const n = items.reduce((s, i) => s + i.qty, 0);
  return <Badge tone="info">🛒 {n}</Badge>;
});

type Action = { type: 'added'; dish: Dish; qty: number } | { type: 'removed'; id: string };

function cartReducer(state: { items: Line[] }, action: Action): { items: Line[] } {
  switch (action.type) {
    case 'added': {
      const existing = state.items.find((i) => i.id === action.dish.id);
      if (existing) {
        return { items: state.items.map((i) => (i.id === action.dish.id ? { ...i, qty: i.qty + action.qty } : i)) };
      }
      return { items: [...state.items, { ...action.dish, qty: action.qty, key: Date.now() }] };
    }
    case 'removed':
      return { items: state.items.filter((i) => i.id !== action.id) };
  }
}

interface CartModel {
  items: Line[]; count: number; total: number;
  add: (d: Dish) => void; addThree: (d: Dish) => void; remove: (line: Line) => void;
}

function useBrokenCart(): CartModel {
  const [items, setItems] = useState<Line[]>([]);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const uid = useRef(0);
  function addItem(dish: Dish) {
    items.push({ ...dish, qty: 1, key: uid.current++ }); // mutation: same array reference
    setItems(items);
    setCount(count + 1); // reads the count from this render
    setTotal(total + dish.price);
  }
  return {
    items, count, total,
    add: addItem,
    addThree: (dish) => { addItem(dish); addItem(dish); addItem(dish); },
    remove: (line) => {
      setItems(items.filter((i) => i !== line));
      setCount(count - 1); // forgot to update total
    },
  };
}

function useFixedCart(): CartModel {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });
  const count = state.items.reduce((n, i) => n + i.qty, 0); // derived, never stored
  const total = state.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  return {
    items: state.items, count, total,
    add: (dish) => dispatch({ type: 'added', dish, qty: 1 }),
    addThree: (dish) => { for (let i = 0; i < 3; i++) dispatch({ type: 'added', dish, qty: 1 }); },
    remove: (line) => dispatch({ type: 'removed', id: line.id }),
  };
}

function CartView({ cart, reset, fixed }: { cart: CartModel; reset: () => void; fixed: boolean }) {
  const rowsQty = cart.items.reduce((n, i) => n + i.qty, 0);
  const rowsTotal = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
  return (
    <Stack gap={14}>
      <Browser url="dinnerdash.example/cart">
        <Stack gap={12}>
          <Row style={{ justifyContent: 'space-between' }}>
            <strong>DinnerDash</strong>
            <CartBadge items={cart.items} />
          </Row>
          <Panel title="Menu">
            <Stack gap={8}>
              {MENU.map((d) => (
                <Row key={d.id} gap={8}>
                  <span style={{ flex: '1 1 140px' }}>{d.name} · ${d.price}</span>
                  <Button onClick={() => cart.add(d)}>Add</Button>
                  <Button onClick={() => cart.addThree(d)}>Add ×3</Button>
                </Row>
              ))}
            </Stack>
          </Panel>
          <Panel title="Your cart">
            <Stack gap={6}>
              {cart.items.length === 0 && <Note>Empty.</Note>}
              {cart.items.map((line) => (
                <Row key={line.key} gap={8}>
                  <span style={{ flex: '1 1 140px' }}>{line.name} × {line.qty}</span>
                  <Button tone="ghost" onClick={() => cart.remove(line)}>Remove</Button>
                </Row>
              ))}
              <span>Items: <strong>{cart.count}</strong> · Total: <strong>${cart.total.toFixed(2)}</strong></span>
            </Stack>
          </Panel>
          <Row><Button tone="ghost" onClick={reset}>Reset</Button></Row>
        </Stack>
      </Browser>
      <Row gap={10}>
        <Stat label="items shown vs rows" value={`${cart.count} / ${rowsQty}`} tone={cart.count === rowsQty ? 'good' : 'bad'} />
        <Stat label="total shown vs rows" value={`$${cart.total} / $${rowsTotal}`} tone={cart.total === rowsTotal ? 'good' : 'bad'} />
      </Row>
      <Code>{fixed
        ? `const [state, dispatch] = useReducer(cartReducer, { items: [] });\nconst count = state.items.reduce((n, i) => n + i.qty, 0);   // derived\nconst total = state.items.reduce((s, i) => s + i.price * i.qty, 0);\ndispatch({ type: 'added', dish, qty: 1 }); // reducer returns new arrays`
        : `function addItem(dish) {\n  items.push({ ...dish, qty: 1 });\n  setItems(items);\n  setCount(count + 1);\n  setTotal(total + dish.price);\n}\n// removeItem: setItems(filtered); setCount(count - 1);`}</Code>
    </Stack>
  );
}

function BrokenCart({ reset }: { reset: () => void }) {
  return <CartView cart={useBrokenCart()} reset={reset} fixed={false} />;
}

function FixedCart({ reset }: { reset: () => void }) {
  return <CartView cart={useFixedCart()} reset={reset} fixed />;
}

export function Problem() {
  return <Resettable>{(reset) => <BrokenCart reset={reset} />}</Resettable>;
}

export function Solution() {
  return <Resettable>{(reset) => <FixedCart reset={reset} />}</Resettable>;
}
