# Coding challenge: build a complete, responsive frontend app that consumes APIs

**Level:** Junior
**Merged from (original phrasings):**
- Build a complete frontend application that consumes APIs, manages state, and is fully responsive.

## The concept (short answer)
- Reviewers of take-home projects check structure and robustness more than features: clear folders, a separate **data layer**, sensible **state** choices, **routing**, **loading/error/empty states**, a **responsive layout**, and a README.
- Recommended stack for a junior take-home: React + Vite (or Next.js), React Router, **TanStack Query** for server state, `useState`/Context for small UI state, CSS Modules or Tailwind, Vitest + RTL for a few tests.
- Separate the two kinds of state: **server state** (data from APIs: cached, refetched, can be stale) belongs in a data library; **client state** (open menu, theme, filters) stays local or in Context. Do not put API data into Redux by hand unless asked.
- All HTTP calls go through **one API client** (base URL, headers, error handling) and small **feature-level functions/hooks** (`useProducts`). Components never call `fetch` directly.
- Every async screen handles **loading, error (with retry), empty and success**. Mobile-first CSS with Grid/Flexbox.

Recommended structure:

```
src/
  api/
    client.js          # fetch wrapper: base URL, JSON, errors, auth header
    products.js        # getProducts, getProduct
  features/
    products/
      useProducts.js   # TanStack Query hooks
      ProductList.jsx
      ProductCard.jsx
      ProductCard.module.css
  components/          # generic UI: Spinner, ErrorMessage, EmptyState, Layout
  pages/               # route-level: HomePage, ProductPage, NotFound
  App.jsx              # providers + routes
  main.jsx
```

## Real-life example: the problem
A typical case: a candidate's take-home "product catalog" was rejected. Reviewer notes: "API URL hard-coded in 6 components, no loading state (blank screen for 2 s), app crashes with 'Cannot read properties of undefined (reading map)' when the API is down, layout breaks below 900px, no README."

```jsx
// ProductsPage.jsx: everything in one component
export default function ProductsPage() {
  const [products, setProducts] = useState();

  useEffect(() => {
    fetch("https://fakestoreapi.com/products")        // duplicated in other files
      .then((r) => r.json())
      .then((data) => setProducts(data));             // no error handling, no res.ok
  }, []);

  return (
    <div style={{ display: "flex", width: "1200px" }}> {/* fixed width */}
      {products.map((p) => (                          // crashes: products is undefined at first
        <div style={{ width: "300px" }} onClick={() => (window.location.href = `/p/${p.id}`)}>
          <img src={p.image} width="300" />
          <b>{p.title}</b>
        </div>
      ))}
    </div>
  );
}
```

## How to fix it
1. One API client with error handling:

```js
// src/api/client.js
const BASE_URL = import.meta.env.VITE_API_URL;      // configurable via .env

export async function apiGet(path, { signal } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

// src/api/products.js
export const getProducts = ({ signal }) => apiGet("/products", { signal });
export const getProduct = (id, { signal }) => apiGet(`/products/${id}`, { signal });
```

2. Server state via TanStack Query hooks:

```js
// src/features/products/useProducts.js
import { useQuery } from "@tanstack/react-query";
import { getProducts, getProduct } from "../../api/products";

export const useProducts = () =>
  useQuery({ queryKey: ["products"], queryFn: getProducts, staleTime: 60_000 });

export const useProduct = (id) =>
  useQuery({ queryKey: ["product", id], queryFn: ({ signal }) => getProduct(id, { signal }) });
```

3. App shell, providers and routing:

```jsx
// src/App.jsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="products/:id" element={<ProductPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

4. A component that handles every state:

```jsx
// src/features/products/ProductList.jsx
import { Link } from "react-router-dom";
import { useProducts } from "./useProducts";
import styles from "./ProductList.module.css";

export function ProductList() {
  const { data: products, isPending, isError, error, refetch } = useProducts();

  if (isPending) return <Spinner label="Loading products" />;
  if (isError) return <ErrorMessage message={error.message} onRetry={refetch} />;
  if (products.length === 0) return <EmptyState text="No products yet." />;

  return (
    <ul className={styles.grid}>
      {products.map((p) => (
        <li key={p.id}>
          <Link to={`/products/${p.id}`} className={styles.card}>
            <img src={p.image} alt={p.title} loading="lazy" />
            <h3>{p.title}</h3>
            <p>{p.price.toFixed(2)} EUR</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

5. Mobile-first responsive CSS:

```css
/* ProductList.module.css */
.grid {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
  list-style: none;
}
.card { display: flex; flex-direction: column; gap: 0.5rem; }
.card img { width: 100%; aspect-ratio: 1; object-fit: contain; }
```

Why it works:
- The API layer is in one place: changing the base URL, adding an auth header or handling 401s is a one-file change, and components stay easy to test.
- TanStack Query gives caching, deduplication, retries, request cancellation and loading/error flags, removing hand-written `useEffect` fetching and race conditions.
- The component renders a clear UI for every state, so a slow or failing API never shows a blank screen or crashes.
- `<Link>` gives client-side navigation and real anchors (keyboard, middle-click, accessibility) instead of `onClick` on a `div`.
- The grid goes from 1 column on phones to several on desktop with no media queries and no horizontal scroll.

Finish with: a top-level error boundary, a `.env.example`, 3-5 RTL tests (loading, error + retry, renders list), and a README with setup, decisions and "what I would do with more time". Alternatives: Next.js App Router with Server Components for data fetching, Zustand or Redux Toolkit if the brief requires complex shared client state.

## How to say it in the interview
- "I separate concerns: an API client and feature hooks for data, TanStack Query for server state, local state or Context for UI state, route-level pages, and small presentational components."
- "Every async view has loading, error with retry, empty and success states, and the layout is mobile-first with CSS Grid."
- Follow-up: "Why not Redux?" Most app state is server state, which a query library handles better; Redux Toolkit makes sense for complex, shared client-side state.
- Trade-off: adding libraries speeds you up but adds dependencies; in a take-home, explain each choice in the README, as reviewers value reasoning as much as code.
