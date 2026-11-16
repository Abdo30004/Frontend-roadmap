import { useEffect, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Note, Panel, Row, Stack, Stat, Steps, sleep, type Tone } from '../../demo-kit';

export const scenario = 'Nordic Home sells furniture online. Marketing shares the new oak table page on social media and waits for Google traffic.';
export const task = 'Press "Crawl the page" and "Share the link", then "Open on a phone". Look at what each one actually receives.';
export const solutionNote = 'Same page moved to the Next.js App Router: server-rendered HTML with metadata, ISR and one small client component.';

const PRODUCT = { name: 'Oak Dining Table', desc: 'Solid oak table for 6, oiled finish, made in Sweden.', price: '899' };

const SPA_HTML = `<html>
<head><title>React App</title></head>
<body><div id="root"></div>
<script src="/static/js/bundle.js"></script></body>
</html>`;

const NEXT_HTML = `<html>
<head><title>${PRODUCT.name} | Nordic Home</title>
<meta name="description" content="${PRODUCT.desc}">
<meta property="og:image" content="/img/oak-table.webp"></head>
<body><main><h1>${PRODUCT.name}</h1>
<p>${PRODUCT.desc}</p><button>Add to cart</button></main></body>
</html>`;

type Step = { label: string; detail: string; tone?: Tone };

function ProductPageSim({ fixed }: { fixed: boolean }) {
  const [view, setView] = useState<'none' | 'crawl' | 'share' | 'phone'>('none');
  const [steps, setSteps] = useState<Step[]>([]);
  const [active, setActive] = useState(-1);
  const [phoneContent, setPhoneContent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const alive = useRef(new AbortController());
  useEffect(() => () => alive.current.abort(), []);

  // What a crawler (no JavaScript executed) can read from the response.
  const html = fixed ? NEXT_HTML : SPA_HTML;
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<title>[\s\S]*?<\/title>/, '').replace(/<[^>]+>/g, ' ').trim();
  const words = text ? text.split(/\s+/).length : 0;
  const title = fixed ? `${PRODUCT.name} | Nordic Home` : 'React App';

  const phone = async () => {
    const s: Step[] = fixed
      ? [
          { label: 'HTML arrives', detail: '0.4 s · already has the table, price, photo', tone: 'good' },
          { label: 'Content visible', detail: '0.6 s · user can read and scroll', tone: 'good' },
          { label: 'Button hydrates', detail: '1.1 s · 45 KB of JS for "Add to cart"', tone: 'good' },
        ]
      : [
          { label: 'HTML arrives', detail: '0.4 s · empty <div id="root">', tone: 'warn' },
          { label: 'Download bundle', detail: '1.9 s · 900 KB of JS', tone: 'warn' },
          { label: 'Run React', detail: '2.4 s · still a spinner', tone: 'warn' },
          { label: 'Fetch product', detail: '3.1 s · first real content', tone: 'bad' },
        ];
    setView('phone');
    setSteps(s);
    setPhoneContent(false);
    setBusy(true);
    try {
      for (let i = 0; i < s.length; i++) {
        setActive(i);
        if (i === (fixed ? 1 : 3)) setPhoneContent(true);
        await sleep(fixed ? 450 : 750, alive.current.signal);
      }
      setBusy(false);
      setSeen((x) => ({ ...x, phone: true }));
    } catch { /* unmounted */ }
  };

  return (
    <Stack gap={14}>
      <Row>
        <Button onClick={() => { setView('crawl'); setSeen((x) => ({ ...x, crawl: true })); }} disabled={busy}>Crawl the page (Googlebot)</Button>
        <Button onClick={() => { setView('share'); setSeen((x) => ({ ...x, share: true })); }} disabled={busy}>Share the link</Button>
        <Button tone="primary" onClick={phone} disabled={busy}>Open on a phone (4G)</Button>
      </Row>

      {view === 'none' && <Note>Pick who visits nordichome.example/products/oak-table.</Note>}

      {view === 'crawl' && (
        <Stack gap={10}>
          <Note>Response body for GET /products/oak-table (the crawler's first pass does not run your JS):</Note>
          <Code>{html}</Code>
          <Panel title="Search result">
            <div style={{ color: 'var(--info)', fontSize: 15 }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--good)' }}>nordichome.example › products › oak-table</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{fixed ? PRODUCT.desc : 'No information is available for this page.'}</div>
          </Panel>
        </Stack>
      )}

      {view === 'share' && (
        <Panel title="Chat · link preview">
          <div style={{ maxWidth: 280, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
            <div style={{ height: 90, display: 'grid', placeItems: 'center', fontSize: 40, background: fixed ? 'var(--warn-soft)' : 'var(--paper-2)' }}>
              {fixed ? '🪵' : <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>no image</span>}
            </div>
            <div style={{ padding: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>nordichome.example</div>
              <strong style={{ fontSize: 14 }}>{title}</strong>
              {fixed && <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{PRODUCT.desc}</div>}
            </div>
          </div>
        </Panel>
      )}

      {view === 'phone' && (
        <Stack gap={10}>
          <Steps steps={steps} active={active} />
          <div style={{ maxWidth: 260 }}>
            <Browser url="nordichome.example/products/oak-table">
              <div style={{ minHeight: 110 }}>
                {phoneContent ? (
                  <Stack gap={6}>
                    <strong>{PRODUCT.name}</strong>
                    <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{PRODUCT.desc}</div>
                    <Row><Badge tone="info">€{PRODUCT.price}</Badge><Button tone="primary" style={{ padding: '4px 10px', fontSize: 13 }}>Add to cart</Button></Row>
                  </Stack>
                ) : (
                  <div style={{ minHeight: 110, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontSize: 13 }}>{fixed ? '…' : '⟳ (white screen + spinner)'}</div>
                )}
              </div>
            </Browser>
          </div>
        </Stack>
      )}

      <Row gap={8}>
        <Stat label="words a crawler can index" value={seen.crawl ? words : '-'} tone={!seen.crawl ? 'neutral' : words > 5 ? 'good' : 'bad'} />
        <Stat label="preview title" value={seen.share ? (fixed ? 'product' : 'React App') : '-'} tone={!seen.share ? 'neutral' : fixed ? 'good' : 'bad'} />
        <Stat label="first content on phone" value={seen.phone ? (fixed ? '0.6 s' : '3.1 s') : '-'} tone={!seen.phone ? 'neutral' : fixed ? 'good' : 'bad'} />
      </Row>

      <Code>{fixed
        ? `// app/products/[id]/page.tsx  (Server Component, ISR)\nexport const revalidate = 300;\nexport async function generateMetadata({ params }) { /* title, og:image */ }\nexport default async function ProductPage({ params }) {\n  const product = await getProduct((await params).id);\n  return <main><h1>{product.name}</h1> ... <AddToCartButton /></main>;\n}`
        : `useEffect(() => {\n  fetch(\`/api/products/\${id}\`).then(r => r.json()).then(setProduct);\n}, [id]);\nif (!product) return <Spinner />;     // what the server sends first\ndocument.title = product.name;        // too late for crawlers/previews`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <ProductPageSim fixed={false} />;
}

export function Solution() {
  return <ProductPageSim fixed />;
}
