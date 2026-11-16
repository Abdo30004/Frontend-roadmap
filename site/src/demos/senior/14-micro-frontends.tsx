import { useEffect, useId, useMemo, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Note, Panel, Row, Stack, Stat, useConsole } from '../../demo-kit';

export const scenario = 'A retail site is a shell plus two remote apps: Catalog (team A) and Checkout (team B). Each team deploys on its own schedule.';
export const task = 'Add an item to the cart. Then press "Team B deploys Checkout 1.42.0" and try again. Watch the cart badge, the buttons and the JS downloaded.';
export const solutionNote = 'Shared React singleton, an event contract instead of store internals, scoped CSS, and a versioned remote manifest.';

type Ver = '1.41.0' | '1.42.0';
interface Bundle { name: string; kb: number; dup?: boolean }

function bundles(fixed: boolean, v: Ver): Bundle[] {
  const next = v === '1.42.0';
  return [
    { name: 'shell.8a1c.js', kb: 38 },
    { name: 'react + react-dom 18.3.1 (shell)', kb: 45 },
    { name: 'catalog/remoteEntry.js', kb: 21 },
    ...(fixed ? [] : [{ name: 'react 18.3.1 (bundled by catalog)', kb: 45, dup: true }]),
    { name: fixed ? `checkout/${v}/remoteEntry.js` : 'checkout/remoteEntry.js', kb: next ? 31 : 29 },
    ...(fixed ? [] : [{ name: `react ${next ? '19.0.0' : '18.3.1'} (bundled by checkout)`, kb: next ? 52 : 45, dup: true }]),
  ];
}

// BROKEN: Catalog dispatches into Checkout's internal Redux store. Checkout renamed the action in 1.42.0.
function checkoutReducer(v: Ver, count: number, action: { type: string }) {
  if (v === '1.41.0' && action.type === 'cart/ADD') return count + 1;
  if (v === '1.42.0' && action.type === 'cart/itemAdded') return count + 1;
  return count; // unknown action: silently ignored
}

const CART_ITEM_ADDED = 'cart:item-added/v1'; // @acme/contracts

function MicroFrontends({ fixed }: { fixed: boolean }) {
  const mfId = useId();
  const scope = `[data-mf="${mfId}"]`;
  const [checkout, setCheckout] = useState<Ver>('1.41.0');
  const [count, setCount] = useState(0);
  const bus = useMemo(() => new EventTarget(), []); // stands in for `window` in this demo
  const c = useConsole();
  const next = checkout === '1.42.0';
  const crashed = !fixed && next; // React 19 hooks running inside a React 18 tree

  // FIXED: Checkout listens to the versioned contract event, whatever its internals are.
  useEffect(() => {
    if (!fixed) return;
    const onAdd = () => setCount((n) => n + 1);
    bus.addEventListener(CART_ITEM_ADDED, onAdd);
    return () => bus.removeEventListener(CART_ITEM_ADDED, onAdd);
  }, [fixed, bus]);

  const addToCart = () => {
    if (fixed) {
      bus.dispatchEvent(new CustomEvent(CART_ITEM_ADDED, { detail: { sku: 'SNK-204', qty: 1 } }));
      c.log(`catalog → emit "${CART_ITEM_ADDED}" { sku: "SNK-204", qty: 1 }`, 'good');
      return;
    }
    const nextCount = checkoutReducer(checkout, count, { type: 'cart/ADD' });
    c.log(`catalog → cartStore.dispatch({ type: "cart/ADD" })`, 'info');
    if (nextCount === count) c.log(`checkout ${checkout} has no "cart/ADD" handler (renamed to "cart/itemAdded") → ignored`, 'bad');
    setCount(nextCount);
  };

  const deploy = (v: Ver) => {
    setCheckout(v);
    c.log(fixed
      ? `mf-manifest.json: checkout → https://cdn.example.com/checkout/${v}/remoteEntry.js (shell untouched)`
      : `team B uploaded checkout/remoteEntry.js (${v}), shell picks up "latest" on next load`, 'info');
  };

  const list = bundles(fixed, checkout);
  const kb = list.reduce((s, b) => s + b.kb, 0);
  const reactCopies = list.filter((b) => b.name.startsWith('react')).length;

  const css = `${scope} .button{font:500 13px var(--font-body);padding:6px 12px;border-radius:8px;border:1px solid var(--line-2);background:var(--surface);color:var(--ink);cursor:pointer;transition:background-color 200ms ease,color 200ms ease}`
    + (next ? (fixed
      ? `${scope} .checkout_pay__x7f2{background:var(--good);color:var(--paper);border-color:var(--good)}`
      : `${scope} .button{background:var(--good);color:var(--paper);border-color:var(--good)}`) : '');

  return (
    <Stack gap={14}>
      <style>{css}</style>
      <Browser url="shop.retailco.example/sneakers">
        <div data-mf={mfId}>
          <Stack gap={12}>
            <Row style={{ justifyContent: 'space-between' }}>
              <strong>RetailCo</strong>
              <Row gap={6}>
                <button type="button" className="button">Deals</button>
                <button type="button" className="button">Account</button>
                <Badge tone={count ? 'info' : 'neutral'}>Cart ({count})</Badge>
              </Row>
            </Row>
            <Row gap={10} align="stretch">
              <Panel title="Catalog · team A" style={{ flex: '1 1 140px' }}>
                <Stack gap={8}>
                  <span>Runner 204 sneakers · €89</span>
                  <Row><button type="button" className="button" onClick={addToCart}>Add to cart</button></Row>
                </Stack>
              </Panel>
              <Panel title={`Checkout · team B · ${checkout}`} tone={crashed ? 'bad' : undefined} style={{ flex: '1 1 140px' }}>
                {crashed ? (
                  <code style={{ fontSize: 12, color: 'var(--bad)' }}>Error: Invalid hook call. You might have more than one copy of React in the same app.</code>
                ) : (
                  <Stack gap={8}>
                    <span>{count} item{count === 1 ? '' : 's'} · €{count * 89}</span>
                    <Row><button type="button" className={fixed && next ? 'button checkout_pay__x7f2' : 'button'}>Pay now</button></Row>
                  </Stack>
                )}
              </Panel>
            </Row>
          </Stack>
        </div>
      </Browser>

      <Row>
        <Button tone="primary" onClick={() => deploy('1.42.0')} disabled={next}>Team B deploys Checkout 1.42.0</Button>
        {fixed && <Button onClick={() => deploy('1.41.0')} disabled={!next}>Roll back to 1.41.0</Button>}
        <Button tone="ghost" onClick={() => { setCheckout('1.41.0'); setCount(0); c.clear(); }}>Reset</Button>
        <Badge>shell 3.8.0 · not redeployed</Badge>
      </Row>

      <Row gap={8}>
        <Stat label="JS downloaded" value={`${kb} KB`} tone={fixed ? 'good' : 'bad'} />
        <Stat label="copies of React" value={reactCopies} tone={reactCopies > 1 ? 'bad' : 'good'} />
        <Stat label="cart badge" value={count} />
      </Row>

      <Panel title="Network">
        <Stack gap={4}>
          {list.map((b) => (
            <Row key={b.name} gap={6} style={{ fontSize: 13 }}>
              <code>{b.name}</code> <Badge tone={b.dup ? 'bad' : 'neutral'}>{b.kb} KB</Badge>
            </Row>
          ))}
        </Stack>
      </Panel>

      <Code>{fixed
        ? `shared: { react: { singleton: true, requiredVersion: '^18.3.0' }, 'react-dom': {...} }\nemitCartItemAdded({ sku, qty: 1 });          // contract 'cart:item-added/v1'\n.pay { background: green }   /* CSS Module → .checkout_pay__x7f2 */`
        : `new ModuleFederationPlugin({ name: 'checkout', exposes: { './CartStore': ... } }) // no shared\ncartStore.dispatch({ type: 'cart/ADD', payload: product });\n.button { background: green; }   /* checkout/styles.css, global */`}</Code>
      <Console lines={c.lines} height={110} onClear={c.clear} />
      <Note>The shell never changes: only team B's remote is deployed.</Note>
    </Stack>
  );
}

export function Problem() {
  return <MicroFrontends fixed={false} />;
}

export function Solution() {
  return <MicroFrontends fixed />;
}
