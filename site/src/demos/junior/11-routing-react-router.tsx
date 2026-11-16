import { useState, type ContextType, type MouseEvent, type ReactNode } from 'react';
import {
  Link, MemoryRouter, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useParams,
  UNSAFE_LocationContext, UNSAFE_RouteContext,
} from 'react-router-dom';
import { Badge, Browser, Button, Code, Note, Row, Stack, Stat } from '../../demo-kit';

export const scenario = 'A small online shop: add deals to your cart on the home page, browse products and open a product page. The header shows your cart.';
export const task = 'Add 2 deals to the cart, click "Products" in the header, then open any product. Watch the cart and the page.';
export const solutionNote = 'Same shop: a layout route with <Outlet />, <NavLink> instead of <a href>, and a :productId param.';

interface Product { id: string; name: string; price: number }
const PRODUCTS: Product[] = [
  { id: '1', name: 'Trail running shoes', price: 89 },
  { id: '2', name: 'Rain jacket', price: 120 },
  { id: '3', name: 'Water bottle', price: 18 },
];

// The site itself runs inside a BrowserRouter. These providers give the demo its own, separate router.
type LocationCtx = ContextType<typeof UNSAFE_LocationContext>;
function Isolated({ children }: { children: ReactNode }) {
  return (
    <UNSAFE_LocationContext.Provider value={null as unknown as LocationCtx}>
      <UNSAFE_RouteContext.Provider value={{ outlet: null, matches: [], isDataRoute: false }}>{children}</UNSAFE_RouteContext.Provider>
    </UNSAFE_LocationContext.Provider>
  );
}

function ProductPage({ onAdd }: { onAdd: (p: Product) => void }) {
  const { productId } = useParams(); // "2" for /products/2
  const navigate = useNavigate();
  const p = PRODUCTS.find((x) => x.id === productId);
  if (!p) return <Note>Product not found.</Note>;
  return (
    <Stack gap={6}>
      <strong>{p.name}</strong>
      <span>${p.price}</span>
      <Row><Button onClick={() => onAdd(p)}>Add to cart</Button><Button tone="ghost" onClick={() => navigate('/products')}>Back to products</Button></Row>
    </Stack>
  );
}

interface ShopProps { fixed: boolean; loads: number; hardNavigate: (path: string) => void }

function Shop({ fixed, loads, hardNavigate }: ShopProps) {
  const [cart, setCart] = useState<string[]>([]); // in-memory state
  const location = useLocation();
  const add = (p: Product) => setCart((c) => [...c, p.id]);

  // A plain <a href>: the browser throws the page away and loads the URL from scratch (simulated here).
  const a = (to: string, label: string) => (
    <a href={to} onClick={(e: MouseEvent) => { e.preventDefault(); hardNavigate(to); }} style={{ color: 'var(--accent)' }}>{label}</a>
  );
  const link = (to: string, label: string) => (
    <NavLink to={to} end style={({ isActive }) => ({ color: 'var(--accent)', fontWeight: isActive ? 700 : 400 })}>{label}</NavLink>
  );

  const header = (
    <Row gap={12} style={{ paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
      <strong>TrailShop</strong>
      {fixed ? link('/', 'Home') : a('/', 'Home')}
      {fixed ? link('/products', 'Products') : a('/products', 'Products')}
      <Badge tone="info">🛒 {cart.length}</Badge>
    </Row>
  );

  const home = (
    <Stack gap={6}>
      <strong>Today's deals</strong>
      {PRODUCTS.slice(0, 2).map((p) => (
        <Row key={p.id} gap={8}><span style={{ flex: '1 1 140px' }}>{p.name} · ${p.price}</span><Button onClick={() => add(p)}>Add to cart</Button></Row>
      ))}
    </Stack>
  );

  const list = (
    <Stack gap={6}>
      <strong>All products</strong>
      {PRODUCTS.map((p) => <Link key={p.id} to={`/products/${p.id}`} style={{ color: 'var(--accent)' }}>{p.name}</Link>)}
    </Stack>
  );

  return (
    <Stack gap={14}>
      <Browser url={`trailshop.example${location.pathname}`}>
        <div style={{ minHeight: 150 }}>
          {fixed ? (
            <Routes>
              <Route path="/" element={<Stack gap={10}>{header}<Outlet /></Stack>}>
                <Route index element={home} />
                <Route path="products" element={list} />
                <Route path="products/:productId" element={<ProductPage onAdd={add} />} />
                <Route path="*" element={<Note>404 · Page not found</Note>} />
              </Route>
            </Routes>
          ) : (
            <Routes>
              <Route path="/" element={<Stack gap={10}>{header}{home}</Stack>} />
              <Route path="/products" element={list} />
              <Route path="/products/id" element={<ProductPage onAdd={add} />} />
            </Routes>
          )}
        </div>
      </Browser>
      <Row gap={10}>
        <Stat label="cart (in memory)" value={cart.length} />
        <Stat label="full page loads" value={loads} tone={loads > 1 ? 'bad' : 'good'} />
        <Button tone="ghost" onClick={() => hardNavigate('/')}>Type trailshop.example/ in the URL bar</Button>
      </Row>
    </Stack>
  );
}

function RouterDemo({ fixed }: { fixed: boolean }) {
  const [boot, setBoot] = useState({ key: 0, path: '/', loads: 1 });
  const hardNavigate = (path: string) => setBoot((b) => ({ key: b.key + 1, path, loads: b.loads + 1 }));
  return (
    <Stack gap={14}>
      <Isolated>
        <MemoryRouter key={boot.key} initialEntries={[boot.path]}>
          <Shop fixed={fixed} loads={boot.loads} hardNavigate={hardNavigate} />
        </MemoryRouter>
      </Isolated>
      <Code>{fixed
        ? `<Route path="/" element={<RootLayout />}>   {/* header + <Outlet /> */}\n  <Route index element={<Home />} />\n  <Route path="products" element={<ProductList />} />\n  <Route path="products/:productId" element={<ProductPage />} />\n  <Route path="*" element={<NotFound />} />\n</Route>\n// header: <NavLink to="/products">Products</NavLink>`
        : `<Route path="/" element={<><Header /><Home /></>} />\n<Route path="/products" element={<ProductList />} />\n<Route path="/products/id" element={<ProductPage />} />\n// Header: <a href="/products">Products</a>`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <RouterDemo fixed={false} />;
}

export function Solution() {
  return <RouterDemo fixed />;
}
