# How do you implement routing in React with react-router-dom (v6+)?

**Level:** Junior
**Merged from (original phrasings):**
- How do you implement routing in React using react-router-dom?

## The concept (short answer)
- React apps are usually **single-page apps (SPA)**: the server sends one HTML page, and the router decides which component to show based on the URL, **without a full page reload**. It uses the browser History API (`pushState`).
- Main pieces in v6+ (same ideas in v7, where you can import from `react-router`):
  - `createBrowserRouter` + `<RouterProvider>` (recommended "data router"), or `<BrowserRouter>` + `<Routes>` + `<Route>`.
  - `<Link to="/x">` / `<NavLink>` for navigation (no reload). A plain `<a href>` causes a **full reload** and loses state.
  - `useNavigate()` to navigate in code (e.g. after a form submit).
  - `useParams()` for dynamic segments like `/products/:id`; `useSearchParams()` for `?sort=price`.
  - **Nested routes** + `<Outlet />` for shared layouts (header, sidebar).
  - A catch-all `path="*"` route for 404, and `errorElement` for errors.
- Protected pages: check auth in a layout route and return `<Navigate to="/login" replace />`. This is a **UX** guard only; the API must still check permissions.
- Deployment: the server must return `index.html` for every route, or deep links / refresh give a **404**.

## Real-life example: the problem
Imagine an online shop. Users reported: clicking a product in the menu **reloaded the whole page** and **emptied the cart**; the product page showed the same product for every URL; logged-out users could open `/account` and saw a broken page; and the header disappeared on product pages.

```jsx
// BROKEN: App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<><Header /><Home /></>} />
        <Route path="/products" element={<ProductList />} />          {/* no header */}
        <Route path="/products/id" element={<ProductPage />} />        {/* literal "id", not a param */}
        <Route path="/account" element={<Account />} />               {/* no auth check */}
      </Routes>
    </BrowserRouter>
  );
}

function Header() {
  return (
    <nav>
      <a href="/products">Products</a>  {/* full page reload -> in-memory cart lost */}
    </nav>
  );
}

function ProductPage() {
  const product = useProduct(1); // hard-coded id
  return <h1>{product.name}</h1>;
}
```

## How to fix it

```jsx
// FIXED: main.jsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,          // header + <Outlet />
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Home /> },
      { path: 'products', element: <ProductList /> },
      { path: 'products/:productId', element: <ProductPage /> },
      {
        element: <RequireAuth />,     // layout route that guards its children
        children: [{ path: 'account', element: <Account /> }],
      },
      { path: 'login', element: <Login /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
```

```jsx
// FIXED: layout, links, params, guard
import { NavLink, Outlet, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';

function RootLayout() {
  return (
    <>
      <nav>
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/products">Products</NavLink> {/* client-side, no reload */}
        <NavLink to="/account">Account</NavLink>
      </nav>
      <main>
        <Outlet /> {/* child route renders here */}
      </main>
    </>
  );
}

function ProductPage() {
  const { productId } = useParams();       // "42" for /products/42 (always a string)
  const navigate = useNavigate();
  const product = useProduct(productId);

  if (!product) return <p>Loading...</p>;
  return (
    <>
      <h1>{product.name}</h1>
      <button onClick={() => navigate('/products')}>Back to products</button>
    </>
  );
}

function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    // remember where the user wanted to go; replace so "Back" doesn't loop
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
```

Why it works:
- `NavLink`/`Link` change the URL with the History API, so React keeps running and in-memory state (the cart) survives. `NavLink` also adds an `active` class for styling.
- `:productId` is a dynamic segment read with `useParams`.
- Nested routes with `<Outlet />` share the header on every page; the guard is a layout route, so any page added under it is protected automatically.
- `path="*"` handles unknown URLs; `errorElement` catches errors in route rendering.

Alternatives: `<BrowserRouter>` + `<Routes>` nested `<Route>` JSX works too (same concepts). In **Next.js** you do not use react-router; routing is file-based (`app/products/[id]/page.tsx`).

## How to say it in the interview
- "react-router maps URLs to components on the client using the History API, so navigation doesn't reload the page. I use `createBrowserRouter`, nested routes with `<Outlet />` for layouts, `:params` with `useParams`, and a `*` route for 404."
- "I navigate with `<Link>`/`<NavLink>`, or `useNavigate` after an action; a plain `<a href>` causes a full reload and loses state."
- Trap: refreshing `/products/42` gives a 404 in production if the server isn't configured to fall back to `index.html`.
- Trade-off: route guards in the client are only for UX; real security must be on the server. For large apps, lazy-load routes (`lazy`) to keep the first bundle small.
