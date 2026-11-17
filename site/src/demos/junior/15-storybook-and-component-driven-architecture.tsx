import { Component, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Badge, Code, Note, Row, Stack } from '../../demo-kit';

export const scenario = 'A shop team keeps its ProductCard in a mini Storybook, one story per state, before it ships to the category page.';
export const task = 'Click through every story in the sidebar. Look at the canvas and at the automatic checks under it.';
export const solutionNote =
  'Same stories, but the card is built for every state: skeleton, wrapping title, fallbacks, disabled when out of stock.';

interface Product {
  id: string;
  name?: string;
  price?: number;
  salePrice?: number | null;
  inStock?: boolean;
}
interface CardProps {
  product?: Product;
  isLoading?: boolean;
  onAddToCart: (id: string) => void;
}

const base: Product = { id: 'p1', name: 'Wireless Headphones', price: 89.99, salePrice: null, inStock: true };
const STORIES: { name: string; args: Omit<CardProps, 'onAddToCart'> }[] = [
  { name: 'Default', args: { product: base } },
  { name: 'OnSale', args: { product: { ...base, salePrice: 59.99 } } },
  {
    name: 'LongName',
    args: { product: { ...base, salePrice: 59.99, name: 'Noise-Cancelling Over-Ear Wireless Headphones with 40h Battery' } },
  },
  { name: 'OutOfStock', args: { product: { ...base, inStock: false } } },
  { name: 'Loading', args: { isLoading: true } },
  { name: 'Empty', args: { product: { id: 'p9' } } },
];

const CSS = `
.sb15 .card { position: relative; box-sizing: border-box; width: 240px; border: 1px solid var(--line); border-radius: 10px; padding: 12px; background: var(--surface); }
.sb15 .img { height: 70px; border-radius: 8px; background: var(--paper-2); display: grid; place-items: center; font-size: 30px; }
.sb15 .badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; background: var(--bad); color: var(--paper); }
.sb15 .btn { margin-top: 8px; padding: 7px 12px; border-radius: 8px; border: none; background: var(--accent); color: var(--paper); font: 600 13px var(--font-body); cursor: pointer; }
.sb15 .btn:disabled { background: var(--line-2); color: var(--ink-3); cursor: not-allowed; }
.sb15 p { margin: 4px 0 0; font-size: 13px; }
/* buggy card: badge pinned on top of the title, title on one line */
.sb15 .v1 .badge { position: absolute; top: 92px; right: 10px; }
.sb15 .v1 h3 { margin: 8px 0 0; font-size: 14px; white-space: nowrap; }
/* fixed card: badge in normal flow, title wraps (max 2 lines) */
.sb15 .v2 h3 { margin: 6px 0 0; font-size: 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sb15 .skel { height: 14px; border-radius: 6px; background: var(--paper-2); margin-top: 8px; }
`;

function CardV1({ product, onAddToCart }: CardProps) {
  if (!product) return null; // no loading state
  return (
    <div className="card v1">
      <div className="img" aria-hidden>
        🎧
      </div>
      <h3>{product.name}</h3>
      {product.salePrice && <span className="badge">SALE</span>}
      <p>{(product.salePrice ?? product.price)!.toFixed(2)} EUR</p>
      <button type="button" className="btn" onClick={() => onAddToCart(product.id)}>
        Add
      </button>
    </div>
  );
}

function CardV2({ product, isLoading, onAddToCart }: CardProps) {
  if (isLoading || !product) {
    return (
      <div className="card v2" aria-busy="true">
        <div className="img" />
        <div className="skel" />
        <div className="skel" style={{ width: '60%' }} />
      </div>
    );
  }
  const { name, price, salePrice, inStock = false } = product;
  const shown = salePrice ?? price;
  return (
    <article className="card v2">
      <div className="img" aria-hidden>
        🎧
      </div>
      {salePrice != null && (
        <div style={{ marginTop: 8 }}>
          <span className="badge">SALE</span>
        </div>
      )}
      <h3 title={name}>{name || 'Untitled product'}</h3>
      <p>{shown != null ? `${shown.toFixed(2)} EUR` : 'Price unavailable'}</p>
      <button type="button" className="btn" disabled={!inStock || shown == null} onClick={() => onAddToCart(product.id)}>
        {inStock ? 'Add to cart' : 'Out of stock'}
      </button>
    </article>
  );
}

/** Like Storybook's red error screen: a story that throws does not take the whole UI down. */
class StoryBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    if (this.state.error)
      return (
        <div data-crash style={{ color: 'var(--bad)', font: '12px var(--font-mono)' }}>
          ✖ {this.state.error}
        </div>
      );
    return this.props.children;
  }
}

type Check = { label: string; ok: boolean };

/** Real checks on the rendered DOM (what visual/interaction tests catch in CI). */
function runChecks(canvas: HTMLElement, story: (typeof STORIES)[number]): Check[] {
  const crash = canvas.querySelector('[data-crash]');
  const card = canvas.querySelector<HTMLElement>('.card');
  const title = canvas.querySelector<HTMLElement>('h3');
  const badge = canvas.querySelector<HTMLElement>('.badge');
  const btn = canvas.querySelector<HTMLButtonElement>('button');
  const checks: Check[] = [
    { label: 'renders without crashing', ok: !crash },
    { label: 'shows something', ok: !!card },
  ];
  if (title) checks.push({ label: 'title fits inside the card', ok: title.scrollWidth <= title.clientWidth + 1 });
  if (title && badge) {
    const range = document.createRange();
    range.selectNodeContents(title); // the text itself, not the full-width block
    const a = range.getBoundingClientRect();
    const b = badge.getBoundingClientRect();
    const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    checks.push({ label: 'SALE badge does not cover the title', ok: !overlap });
  }
  if (story.args.product?.inStock === false) checks.push({ label: 'out of stock → button disabled', ok: !!btn?.disabled });
  return checks;
}

function MiniStorybook({ fixed }: { fixed: boolean }) {
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [checks, setChecks] = useState<Check[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const story = STORIES[active];
  const Card = fixed ? CardV2 : CardV1;

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    const c = runChecks(canvasRef.current, story);
    setChecks(c);
    setResults((r) => ({ ...r, [story.name]: c.every((x) => x.ok) }));
  }, [active, fixed, story]);

  return (
    <Stack gap={12}>
      <style>{CSS}</style>
      <div
        className="sb15"
        style={{ border: '1px solid var(--line-2)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}
      >
        <div
          style={{
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--ink-3)',
            background: 'var(--paper-2)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          Storybook · Shop / ProductCard
        </div>
        <Row gap={0} align="stretch">
          <nav style={{ flex: '1 1 130px', maxWidth: 170, padding: 8, borderRight: '1px solid var(--line)' }}>
            {STORIES.map((s, i) => (
              <button
                key={s.name}
                type="button"
                onClick={() => {
                  setActive(i);
                  setAdded([]);
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  width: '100%',
                  gap: 6,
                  padding: '6px 8px',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  font: '13px var(--font-body)',
                  textAlign: 'left',
                  background: i === active ? 'var(--accent-soft)' : 'transparent',
                  color: 'var(--ink)',
                  transition: 'background-color 160ms ease',
                }}
              >
                {s.name}
                <span style={{ color: results[s.name] === undefined ? 'var(--ink-3)' : results[s.name] ? 'var(--good)' : 'var(--bad)' }}>
                  {results[s.name] === undefined ? '·' : results[s.name] ? '✓' : '✗'}
                </span>
              </button>
            ))}
          </nav>
          <div ref={canvasRef} style={{ flex: '1 1 230px', padding: 16, minHeight: 200, background: 'var(--paper)' }}>
            <StoryBoundary key={`${fixed}-${story.name}`}>
              <Card {...story.args} onAddToCart={(id) => setAdded((a) => [...a, id])} />
            </StoryBoundary>
          </div>
        </Row>
      </div>

      <Row gap={6}>
        {checks.map((c) => (
          <Badge key={c.label} tone={c.ok ? 'good' : 'bad'}>
            {c.ok ? '✓' : '✗'} {c.label}
          </Badge>
        ))}
        {added.length > 0 && (
          <Badge tone={story.args.product?.inStock === false ? 'bad' : 'info'}>onAddToCart called ×{added.length}</Badge>
        )}
      </Row>
      {!fixed && <Note>"Default" and "OnSale" look fine. That is all anyone checked on staging.</Note>}
      <Code>{`export default { title: 'Shop/ProductCard', component: ProductCard };
export const LongName = { args: { product: { ...base, salePrice: 59.99, name: '…40h Battery' } } };
export const Loading  = { args: { isLoading: true } };
export const Empty    = { args: { product: { id: 'p9' } } };`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <MiniStorybook fixed={false} />;
}

export function Solution() {
  return <MiniStorybook fixed />;
}
