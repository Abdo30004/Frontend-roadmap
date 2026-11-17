import { useState } from 'react';
import { Badge, Browser, Button, Code, Console, Input, Label, Note, Panel, Row, Stack, Stat, useConsole, type Tone } from '../../demo-kit';

export const scenario =
  'An electronics store renders its product pages with Next.js. Staff change prices in the admin, customers reload the product page.';
export const task = 'Set a new price in the admin and save. Then click "Customer reloads" a few times (try "Wait 5 min" too).';
export const solutionNote = 'Same page, now with revalidate: 300 (ISR), or getServerSideProps for always-fresh data.';

type Strategy = 'ssg' | 'isr' | 'ssr';
interface Cached {
  price: number;
  builtAt: number;
}

const REVALIDATE_MIN = 5;

function Store({ fixed }: { fixed: boolean }) {
  const [strategy, setStrategy] = useState<Strategy>(fixed ? 'isr' : 'ssg');
  const [dbPrice, setDbPrice] = useState(349);
  const [draft, setDraft] = useState('299');
  const [now, setNow] = useState(0); // minutes since the last deploy
  const [cache, setCache] = useState<Cached>({ price: 349, builtAt: 0 });
  const [shown, setShown] = useState<{ price: number; status: string; tone: Tone } | null>(null);
  const [apiCalls, setApiCalls] = useState(1); // 1 = the build itself
  const c = useConsole();

  const save = () => {
    const p = Number(draft);
    if (!Number.isFinite(p) || p <= 0) return;
    setDbPrice(p);
    c.log(`admin: UPDATE products SET price = ${p} WHERE slug = 'wh-1000xm5'`, 'info');
  };

  const reload = () => {
    if (strategy === 'ssr') {
      setApiCalls((n) => n + 1);
      setShown({ price: dbPrice, status: 'SSR · rendered now', tone: 'info' });
      c.log(`GET /products/wh-1000xm5 → getServerSideProps → API call → $${dbPrice} (TTFB ≈ 900 ms)`, 'info');
      return;
    }
    const age = now - cache.builtAt;
    if (strategy === 'ssg' || age < REVALIDATE_MIN) {
      setShown({ price: cache.price, status: 'HIT', tone: 'good' });
      c.log(
        `GET /products/wh-1000xm5 → x-nextjs-cache: HIT (built ${age} min ago) → $${cache.price}`,
        cache.price === dbPrice ? 'good' : 'bad',
      );
      return;
    }
    // ISR: serve the stale page now, regenerate in the background for the next visitor.
    setShown({ price: cache.price, status: 'STALE · regenerating', tone: 'warn' });
    setCache({ price: dbPrice, builtAt: now });
    setApiCalls((n) => n + 1);
    c.log(`GET /products/wh-1000xm5 → x-nextjs-cache: STALE → $${cache.price}; background getStaticProps → $${dbPrice}`, 'warn');
  };

  const wait = () => {
    setNow((t) => t + 5);
    c.log('⏱ 5 minutes pass…');
  };

  const redeploy = () => {
    setCache({ price: dbPrice, builtAt: now });
    setApiCalls((n) => n + 1);
    c.log(`next build → getStaticProps runs once → page baked with $${dbPrice}`, 'info');
  };

  const stale = shown !== null && shown.price !== dbPrice;
  const config: Record<Strategy, string> = {
    ssg: `export async function getStaticProps({ params }) {
  const product = await getProduct(params.slug);
  return { props: { product } };              // no revalidate: built once, at deploy
}`,
    isr: `export async function getStaticProps({ params }) {
  const product = await getProduct(params.slug);
  return { props: { product }, revalidate: 300 }; // regenerate at most every 5 min
}
// + CMS webhook: revalidateTag('product:wh-1000xm5') for instant updates`,
    ssr: `export async function getServerSideProps({ params }) {
  return { props: { product: await getProduct(params.slug) } }; // every request hits the API
}`,
  };

  return (
    <Stack gap={14}>
      {fixed && (
        <Row gap={6}>
          <Button tone={strategy === 'isr' ? 'primary' : 'default'} onClick={() => setStrategy('isr')}>
            ISR (revalidate: 300)
          </Button>
          <Button tone={strategy === 'ssr' ? 'primary' : 'default'} onClick={() => setStrategy('ssr')}>
            SSR
          </Button>
        </Row>
      )}
      <Row gap={10} align="stretch">
        <Panel title="Admin (writes to the DB)" style={{ flex: '1 1 220px' }}>
          <Stack gap={8}>
            <Label text="Price for WH-1000XM5 ($)">
              <Input type="number" min={1} value={draft} onChange={(e) => setDraft(e.target.value)} />
            </Label>
            <Row>
              <Button onClick={save}>Save price</Button>
              <Badge tone="info">DB: ${dbPrice}</Badge>
            </Row>
          </Stack>
        </Panel>
        <Panel title="Time & deploys" style={{ flex: '1 1 160px' }}>
          <Stack gap={8}>
            <Note>
              {now} min since deploy · page built at min {cache.builtAt}
            </Note>
            <Row>
              <Button onClick={wait}>Wait 5 min</Button>
              <Button tone="ghost" onClick={redeploy}>
                Redeploy
              </Button>
            </Row>
          </Stack>
        </Panel>
      </Row>
      <Browser url="shop.example/products/wh-1000xm5">
        <Stack gap={8}>
          <strong>Sony WH-1000XM5 · Noise-cancelling headphones</strong>
          {shown ? (
            <Row>
              <span
                style={{ font: '600 24px var(--font-mono)', color: stale ? 'var(--bad)' : 'var(--ink)', transition: 'color 200ms ease' }}
              >
                ${shown.price}
              </span>
              <Badge tone={shown.tone}>{shown.status}</Badge>
            </Row>
          ) : (
            <Note>The customer has not opened the page yet.</Note>
          )}
          <Row>
            <Button tone="primary" onClick={reload}>
              ⟳ Customer reloads
            </Button>
          </Row>
        </Stack>
      </Browser>
      <Row gap={8}>
        <Stat label="price in DB" value={`$${dbPrice}`} />
        <Stat label="customer sees" value={shown ? `$${shown.price}` : '–'} tone={!shown ? 'neutral' : stale ? 'bad' : 'good'} />
        <Stat label="product API calls" value={apiCalls} tone={strategy === 'ssr' && apiCalls > 5 ? 'warn' : 'neutral'} />
      </Row>
      <Code>{config[strategy]}</Code>
      <Console lines={c.lines} height={130} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <Store fixed={false} />;
}

export function Solution() {
  return <Store fixed />;
}
