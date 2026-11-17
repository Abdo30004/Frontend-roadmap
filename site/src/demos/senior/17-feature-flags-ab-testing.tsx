import { useEffect, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Input, Label, Note, Row, Stack, Stat, fakeRequest, useConsole } from '../../demo-kit';

export const scenario =
  'A shop A/B tests a new one-page checkout against the current three-step checkout. Half of the users should see each version.';
export const task =
  'Start typing your email right away, then press "Refresh page" a few times. Watch the page and the "variants seen" counter.';
export const solutionNote =
  'Variant decided before the first render from a hash of the user id, so it never swaps and never changes on refresh.';

type Variant = 'control' | 'onepage';
const USERS = ['u_1842', 'u_3051', 'u_77', 'anon_9f2c'];
const FLAG = 'checkout-onepage';

// FNV-1a: a tiny, stable string hash. Same input → same bucket on every device and request.
function fnv1a(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
const bucketOf = (user: string) => fnv1a(`${FLAG}:${user}`) % 100;
const variantFor = (user: string): Variant => (bucketOf(user) < 50 ? 'onepage' : 'control');

function CheckoutPage({
  fixed,
  user,
  log,
  onShown,
}: {
  fixed: boolean;
  user: string;
  log: (t: string, tone?: 'neutral' | 'bad' | 'good' | 'warn' | 'info') => void;
  onShown: (v: Variant, swapped: boolean) => void;
}) {
  // FIXED: the server evaluated the flag and bootstrapped it into the HTML → known on first render.
  const [variant, setVariant] = useState<Variant>(() => (fixed ? variantFor(user) : 'control'));
  const first = useRef(true);
  const t0 = useRef(performance.now());

  useEffect(() => {
    onShown(variant, !first.current);
    log(
      `${Math.round(performance.now() - t0.current)} ms: painted "${variant}"${first.current ? '' : '  ← swapped after paint'}`,
      first.current ? 'neutral' : 'bad',
    );
    first.current = false;
  }, [variant]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (fixed) {
      log(`bucket = fnv1a("${FLAG}:${user}") % 100 = ${bucketOf(user)} → ${variant}`, 'info');
      log(`track("$exposure", { experiment: "${FLAG}", variant: "${variant}" })`, 'good');
      return;
    }
    // BROKEN: flags fetched after first paint, then a coin flip on every page load.
    const ac = new AbortController();
    log('track("checkout_viewed")  (no variant attached)', 'warn');
    fakeRequest(null, { delay: 700, signal: ac.signal })
      .then(() => setVariant(Math.random() < 0.5 ? 'onepage' : 'control'))
      .catch(() => {});
    return () => ac.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return variant === 'control' ? (
    <Stack gap={10}>
      <Row gap={6}>
        <Badge tone="info">1 Shipping</Badge>
        <Badge>2 Payment</Badge>
        <Badge>3 Review</Badge>
      </Row>
      <Label text="Email">
        <Input placeholder="you@example.com" />
      </Label>
      <Label text="Street address">
        <Input placeholder="12 Market St" />
      </Label>
      <Row>
        <Button tone="primary">Continue to payment</Button>
      </Row>
    </Stack>
  ) : (
    <Stack gap={10}>
      <Row gap={6}>
        <Badge tone="good">One-page checkout</Badge>
        <Badge>Express</Badge>
      </Row>
      <Row gap={8}>
        <Label text="Email">
          <Input placeholder="you@example.com" />
        </Label>
        <Label text="Card">
          <Input placeholder="4242 4242 4242 4242" />
        </Label>
      </Row>
      <Row>
        <Button tone="primary">Pay €89.00</Button>
      </Row>
    </Stack>
  );
}

function Experiment({ fixed }: { fixed: boolean }) {
  const [user, setUser] = useState(USERS[0]);
  const [load, setLoad] = useState(0);
  const [seen, setSeen] = useState<Record<string, Variant[]>>({});
  const [swaps, setSwaps] = useState(0);
  const c = useConsole();

  const onShown = (v: Variant, swapped: boolean) => {
    if (swapped) setSwaps((n) => n + 1);
    setSeen((s) => {
      const list = s[user] ?? [];
      return { ...s, [user]: list.includes(v) ? list : [...list, v] };
    });
  };
  const refresh = () => {
    c.log(`— reload (${user}) —`, 'neutral');
    setLoad((n) => n + 1);
  };
  const mine = seen[user] ?? [];
  const settled = mine.length;

  return (
    <Stack gap={14}>
      <Row gap={6}>
        <Note>Signed in as:</Note>
        {USERS.map((u) => (
          <Button
            key={u}
            tone={u === user ? 'primary' : 'default'}
            aria-pressed={u === user}
            onClick={() => {
              setUser(u);
              c.log(`— switch user to ${u} —`);
              setLoad((n) => n + 1);
            }}
          >
            {u}
          </Button>
        ))}
      </Row>
      <Browser url="shop.example/checkout">
        <CheckoutPage key={`${user}-${load}`} fixed={fixed} user={user} log={c.log} onShown={onShown} />
      </Browser>
      <Row>
        <Button tone="primary" onClick={refresh}>
          Refresh page
        </Button>
        <Button
          tone="ghost"
          onClick={() => {
            setSeen({});
            setSwaps(0);
            c.clear();
            setLoad((n) => n + 1);
          }}
        >
          Reset
        </Button>
      </Row>
      <Row gap={8}>
        <Stat label="swaps after first paint" value={swaps} tone={swaps ? 'bad' : 'good'} />
        <Stat label={`variants seen by ${user}`} value={settled} tone={settled > 1 ? 'bad' : 'good'} />
        <Stat label="assigned bucket" value={fixed ? bucketOf(user) : 'random'} tone={fixed ? 'info' : 'warn'} />
      </Row>
      <Code>
        {fixed
          ? `// server: variant in the first HTML\nconst variant = fnv1a(\`\${flag}:\${userId}\`) % 100 < 50 ? 'onepage' : 'control';\nreturn variant === 'onepage' ? <OnePageCheckout /> : <ThreeStepCheckout />;`
          : `const [variant, setVariant] = useState('control');\nuseEffect(() => { fetch('/api/flags').then(() =>\n  setVariant(Math.random() < 0.5 ? 'onepage' : 'control')); }, []);`}
      </Code>
      <Console lines={c.lines} height={130} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <Experiment fixed={false} />;
}

export function Solution() {
  return <Experiment fixed />;
}
