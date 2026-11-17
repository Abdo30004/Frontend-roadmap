import { useState, type ReactNode } from 'react';
import { Badge, Browser, Button, Code, Note, Panel, Resettable, Row, Stack, Stat } from '../../demo-kit';

export const scenario =
  'An online grocery cart lists your items, shows the total and, on request, the cheapest item. A side panel shows items in the order you added them.';
export const task = 'Look at the cart list and the total. Then press "Sort by price" and check "Cheapest" and the "Recently added" panel.';
export const solutionNote = 'Same cart: filter + map for rows, reduce starting at 0, and a sorted copy with a numeric comparator.';

interface Item {
  id: string;
  name: string;
  price: number;
  qty: number;
  inStock: boolean;
}

const INITIAL: Item[] = [
  { id: 'oil', name: 'Olive oil', price: 8.99, qty: 1, inStock: true },
  { id: 'banana', name: 'Bananas', price: 0.45, qty: 6, inStock: true },
  { id: 'bread', name: 'Sourdough bread', price: 3.2, qty: 1, inStock: true },
  { id: 'avocado', name: 'Avocados', price: 1.8, qty: 2, inStock: false },
];
const ADDED_ORDER = INITIAL.map((i) => i.id);
const TRUE_CHEAPEST = 'Bananas';

function Cart({ items, sortByPrice, fixed }: { items: Item[]; sortByPrice: boolean; fixed: boolean }) {
  let rows: ReactNode;
  let total: unknown;
  let cheapest: string | null = null;

  if (!fixed) {
    // BROKEN (the real code runs here)
    rows = items.forEach((item) => (
      <li key={item.id}>
        {item.name} × {item.qty}
      </li>
    )) as unknown as ReactNode; // forEach returns undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the broken code is untyped on purpose
    total = (items as any[]).reduce((sum, item) => sum + item.price * item.qty); // no initial value
    if (sortByPrice) {
      // mutates the parent's array, and the comparator returns a boolean
      const byPrice = items.sort(((a: Item, b: Item) => a.price > b.price) as unknown as (a: Item, b: Item) => number);
      cheapest = byPrice[0].name;
    }
  } else {
    const inStock = items.filter((item) => item.inStock);
    const byPrice = [...inStock].sort((a, b) => a.price - b.price); // copy + numeric compare
    const list = sortByPrice ? byPrice : inStock;
    rows = list.map((item) => (
      <li key={item.id}>
        {item.name} × {item.qty}
      </li>
    ));
    total = inStock.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(2);
    if (sortByPrice) cheapest = byPrice[0]?.name ?? null;
  }

  const totalText = `$${String(total)}`;
  const totalOk = /^\$\d+\.\d\d$/.test(totalText);

  return (
    <Panel title="Your cart">
      <Stack gap={8}>
        <ul style={{ margin: 0, paddingLeft: 18, minHeight: 24 }}>{rows}</ul>
        {!rows && <Note>(the list rendered nothing)</Note>}
        <div style={{ overflowWrap: 'anywhere' }}>
          Total: <strong style={{ color: totalOk ? 'var(--ink)' : 'var(--bad)' }}>{totalText}</strong>
        </div>
        {cheapest && (
          <Row gap={6}>
            <span>Cheapest:</span>
            <Badge tone={cheapest === TRUE_CHEAPEST ? 'good' : 'bad'}>{cheapest}</Badge>
          </Row>
        )}
      </Stack>
    </Panel>
  );
}

function RecentlyAdded({ items }: { items: Item[] }) {
  const changed = items.some((item, i) => item.id !== ADDED_ORDER[i]);
  return (
    <Panel title="Recently added" tone={changed ? 'bad' : undefined}>
      <Stack gap={6}>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
          {items.map((item) => (
            <li key={item.id}>
              {item.name}
              {item.inStock ? '' : ' (out of stock)'}
            </li>
          ))}
        </ol>
        {changed && <Badge tone="bad">order changed, but nobody re-ordered it</Badge>}
      </Stack>
    </Panel>
  );
}

function GroceryPage({ fixed, reset }: { fixed: boolean; reset: () => void }) {
  const [items] = useState<Item[]>(() => INITIAL.map((i) => ({ ...i })));
  const [sortByPrice, setSortByPrice] = useState(false);

  return (
    <Stack gap={14}>
      <Browser url="freshcart.example/cart">
        <Stack gap={10}>
          <Row>
            <Button tone={sortByPrice ? 'primary' : 'default'} onClick={() => setSortByPrice((v) => !v)}>
              {sortByPrice ? 'Sorted by price ✓' : 'Sort by price'}
            </Button>
            <Button tone="ghost" onClick={reset}>
              Reset
            </Button>
          </Row>
          <Row gap={10} align="stretch">
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <Cart items={items} sortByPrice={sortByPrice} fixed={fixed} />
            </div>
            <div style={{ flex: '1 1 160px', minWidth: 0 }}>
              <RecentlyAdded items={items} />
            </div>
          </Row>
        </Stack>
      </Browser>
      <Row gap={10}>
        <Stat label="real total (in stock)" value="$14.89" tone="info" />
        <Stat label="real cheapest" value={TRUE_CHEAPEST} tone="info" />
      </Row>
      <Code>
        {fixed
          ? `const inStock = items.filter((i) => i.inStock);\nconst rows = inStock.map((i) => <li key={i.id}>…</li>);\nconst total = inStock.reduce((sum, i) => sum + i.price * i.qty, 0);\nconst byPrice = [...inStock].sort((a, b) => a.price - b.price);`
          : `const rows = items.forEach((i) => <li key={i.id}>…</li>);\nconst total = items.reduce((sum, i) => sum + i.price * i.qty);\nconst byPrice = items.sort((a, b) => a.price > b.price);`}
      </Code>
      {!fixed && (
        <Note>Results can differ between browsers (Chrome vs Firefox): after sorting, check both "Cheapest" and "Recently added".</Note>
      )}
    </Stack>
  );
}

export function Problem() {
  return <Resettable>{(reset) => <GroceryPage fixed={false} reset={reset} />}</Resettable>;
}

export function Solution() {
  return <Resettable>{(reset) => <GroceryPage fixed reset={reset} />}</Resettable>;
}
