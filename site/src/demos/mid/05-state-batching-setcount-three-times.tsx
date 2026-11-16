import { useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Note, Row, Stack, Stat, useConsole } from '../../demo-kit';

export const scenario = 'A grocery delivery checkout lets customers add one avocado with "+", or a pack of three with "+3 bundle". Analytics logs every bundle.';
export const task = 'Click "+3 bundle" once or twice. Compare the quantity with what you expected, and read the analytics log.';
export const solutionNote = 'Same cart: the setter uses an updater (q => q + 1), and the new value is computed once for analytics.';

const MAX = 20;
const PRICE = 1.49;

function CartItem({ fixed }: { fixed: boolean }) {
  const [qty, setQty] = useState(2);
  const [expected, setExpected] = useState(2);
  const renders = useRef(0);
  renders.current++;
  const c = useConsole();

  const addOne = () => {
    if (fixed) setQty((q) => Math.min(q + 1, MAX)); // updater: gets the latest queued value
    else setQty(qty + 1);                           // reads the qty of THIS render
  };

  const addBundle = () => {
    setExpected((e) => Math.min(e + 3, MAX));
    if (fixed) {
      const next = Math.min(qty + 3, MAX); // compute once, use it for state and analytics
      setQty(next);
      c.log(`track('bundle_added', { qty: ${next} })`, 'good');
    } else {
      addOne();
      addOne();
      addOne(); // qty is the same snapshot in all three calls
      c.log(`track('bundle_added', { qty: ${qty} })   ← still the old value`, 'bad');
    }
  };

  const reset = () => { setQty(2); setExpected(2); c.clear(); };
  const ok = qty === expected;

  return (
    <Stack gap={12}>
      <Browser url="freshcart.example/checkout">
        <Stack gap={10}>
          <Row gap={10}>
            <span aria-hidden style={{ fontSize: 28 }}>🥑</span>
            <Stack gap={2} style={{ flex: '1 1 140px' }}>
              <strong>Hass avocados</strong>
              <Note>${PRICE.toFixed(2)} each · max {MAX}</Note>
            </Stack>
            <Badge tone={ok ? 'neutral' : 'bad'}>Qty {qty}</Badge>
          </Row>
          <Row gap={8}>
            <Button onClick={() => { setExpected((e) => Math.min(e + 1, MAX)); addOne(); }}>+</Button>
            <Button tone="primary" onClick={addBundle}>+3 bundle</Button>
            <Button tone="ghost" onClick={reset}>Reset</Button>
          </Row>
          <Row gap={8}>
            <span style={{ color: 'var(--ink-2)', fontSize: 14 }}>Subtotal</span>
            <strong style={{ fontFamily: 'var(--font-mono)' }}>${(qty * PRICE).toFixed(2)}</strong>
          </Row>
        </Stack>
      </Browser>
      <Row gap={8}>
        <Stat label="quantity in cart" value={qty} tone={ok ? 'good' : 'bad'} />
        <Stat label="what the customer expects" value={expected} />
        <Stat label="renders" value={renders.current} />
      </Row>
      <Code>{fixed
        ? `setQty((q) => q + 1); // "+" button\n\nconst next = qty + 3;  // "+3 bundle"\nsetQty(next);\ntrack('bundle_added', { qty: next });`
        : `const addOne = () => setQty(qty + 1);\n\naddOne(); addOne(); addOne(); // qty is 2 in all three\ntrack('bundle_added', { qty });`}</Code>
      <Console title="Analytics" lines={c.lines} height={100} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <CartItem fixed={false} />;
}

export function Solution() {
  return <CartItem fixed />;
}
