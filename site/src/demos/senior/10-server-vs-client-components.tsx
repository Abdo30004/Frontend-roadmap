import { useState } from 'react';
import { Badge, Browser, Button, Code, Note, Panel, Row, Stack, Stat } from '../../demo-kit';

export const scenario =
  'A marketplace product page in Next.js App Router: a markdown description, seller info, and an "Add to cart" button with a quantity picker.';
export const task = 'Try removing "use client" from page.tsx, put it back, then press "View page source" and check the JS stat.';
export const solutionNote = 'Same page: click files to move "use client" down to AddToCart; the page passes a DTO, not the DB row.';

type NodeId = 'page' | 'title' | 'description' | 'addToCart' | 'seller';
interface FileNode {
  id: NodeId;
  file: string;
  kb: number;
  note: string;
  needsClient?: boolean;
}

const RUNTIME_KB = 88; // React + Next client runtime, always shipped
const NODES: FileNode[] = [
  { id: 'page', file: 'page.tsx', kb: 6, note: 'fetches product + seller' },
  { id: 'title', file: 'Title.tsx', kb: 1, note: 'static' },
  { id: 'description', file: 'Description.tsx', kb: 352, note: 'marked + highlight.js' },
  { id: 'addToCart', file: 'AddToCart.tsx', kb: 3, note: 'useState(qty)', needsClient: true },
  { id: 'seller', file: 'SellerCard.tsx', kb: 2, note: 'receives seller' },
];

const ROW = { email: 'payouts@vintagecam.example', iban: 'DE89 3704 0044 0532 0130 00', marginPct: 31 };

function ProductPageSim({ fixed }: { fixed: boolean }) {
  const [directives, setDirectives] = useState<Set<NodeId>>(new Set(['page']));
  const [source, setSource] = useState(false);
  const [qty, setQty] = useState(1);

  const isClient = (id: NodeId) => directives.has(id) || (id !== 'page' && directives.has('page'));
  const error = NODES.find((n) => n.needsClient && !isClient(n.id));
  const shipped = RUNTIME_KB + NODES.filter((n) => isClient(n.id)).reduce((a, n) => a + n.kb, 0);
  // the client page fetches /api/products/:id → the whole DB row; a client SellerCard gets whatever the page passes
  const leaks = isClient('page') || (isClient('seller') && !fixed);
  const sellerProps = leaks ? { name: 'VintageCam', rating: 4.8, ...ROW } : { name: 'VintageCam', rating: 4.8 };

  const toggle = (id: NodeId) => {
    if (!fixed && id !== 'page') return;
    setDirectives((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <Stack gap={12}>
      <Panel title={fixed ? 'app/products/[id]/: click a file to toggle "use client"' : 'app/products/[id]/'}>
        <Stack gap={4}>
          {NODES.map((n) => {
            const client = isClient(n.id);
            const clickable = fixed || n.id === 'page';
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => toggle(n.id)}
                disabled={!clickable}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  alignItems: 'center',
                  textAlign: 'left',
                  font: 'inherit',
                  fontSize: 13,
                  marginLeft: n.id === 'page' ? 0 : 18,
                  padding: '6px 8px',
                  borderRadius: 8,
                  cursor: clickable ? 'pointer' : 'default',
                  border: `1px solid ${directives.has(n.id) ? 'var(--warn)' : 'var(--line)'}`,
                  background: client ? 'var(--warn-soft)' : 'var(--paper)',
                  color: 'var(--ink)',
                  transition: 'background-color 200ms ease, border-color 200ms ease',
                }}
              >
                <code>{n.file}</code>
                {directives.has(n.id) && <Badge tone="warn">'use client'</Badge>}
                <Badge tone={client ? 'warn' : 'good'}>{client ? `client · ${n.kb} KB` : 'server · 0 KB'}</Badge>
                <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{n.note}</span>
              </button>
            );
          })}
        </Stack>
      </Panel>

      <Browser url="market.example.com/products/leica-m6">
        {error ? (
          <Stack gap={6}>
            <Badge tone="bad">Build error</Badge>
            <code
              style={{ fontSize: 12, color: 'var(--bad)' }}
            >{`${error.file}: useState only works in Client Components. Add the "use client" directive.`}</code>
          </Stack>
        ) : (
          <Stack gap={8}>
            <strong>Leica M6, 1984, serviced</strong>
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              Shutter recently <em>CLA'd</em>. Comes with strap and box.
            </span>
            <Row gap={6}>
              <Button onClick={() => setQty((q) => Math.max(1, q - 1))}>−</Button>
              <code>{qty}</code>
              <Button onClick={() => setQty((q) => q + 1)}>+</Button>
              <Button tone="primary">Add to cart · €{(1450 * qty).toLocaleString()}</Button>
            </Row>
            <Note>Sold by VintageCam ★ 4.8</Note>
          </Stack>
        )}
      </Browser>

      <Row gap={8}>
        <Stat label="route JS shipped" value={error ? '—' : `${shipped} KB`} tone={error ? 'neutral' : shipped > 150 ? 'bad' : 'good'} />
        <Stat
          label="seller secrets in HTML"
          value={error ? '—' : leaks ? 'IBAN, email, margin' : 'none'}
          tone={error ? 'neutral' : leaks ? 'bad' : 'good'}
        />
        <Button onClick={() => setSource((s) => !s)} disabled={!!error}>
          {source ? 'Hide' : 'View'} page source
        </Button>
      </Row>

      {source && !error && (
        <Code>{`<script>self.__next_f.push([1,"...\n  \\"seller\\":${JSON.stringify(sellerProps, null, 1).replace(/\n\s*/g, ' ')}\n..."])</script>`}</Code>
      )}

      <Code>
        {fixed
          ? `// page.tsx (Server Component, no directive)\nconst product = await getProductView(id); // DTO, 'server-only'\n<Description md={product.descriptionMd} /> // marked runs on server\n<AddToCart productId={product.id} />      // 'use client' leaf`
          : `'use client';                 // top of page.tsx\nimport { marked } from 'marked';\nimport hljs from 'highlight.js';\n<SellerCard seller={product.seller} /> // whole DB row`}
      </Code>
    </Stack>
  );
}

export function Problem() {
  return <ProductPageSim fixed={false} />;
}

export function Solution() {
  return <ProductPageSim fixed />;
}
