# State Management Architecture: Redux Toolkit vs Context vs Zustand vs Server-State Libraries

**Level:** Senior
**Merged from (original phrasings):**
- Redux Toolkit vs. Context API vs. server-state libraries: when would you choose each?
- Explain the trade-offs between different state management patterns (Redux, Zustand, Context API).
- How do you manage state and caching as the app grows to 100+ screens?

## The concept (short answer)

The senior move is to stop asking "which library?" and first **classify the state**, because each kind has a different owner and lifecycle:

| Kind | Examples | Best home |
|---|---|---|
| **Server state** | orders, users, prices - owned by the backend, can go stale | TanStack Query / RTK Query / SWR (cache, dedup, invalidation, refetch) |
| **URL state** | filters, sort, page, selected tab, search | the URL (`useSearchParams`) - shareable, survives refresh, back button works |
| **Form state** | in-progress edits, validation errors | local state or React Hook Form, discarded on submit |
| **Client/UI state** | sidebar open, theme, multi-step wizard, cart before checkout | `useState` -> lift up -> Zustand/Redux when truly global |

Library trade-offs for the remaining *client* state:
- **Context API:** dependency injection, not a state manager. Every consumer re-renders when the value changes, no selectors. Great for low-frequency values (theme, locale, current user, feature flags).
- **Redux Toolkit:** single store, strict unidirectional flow, devtools with time travel, middleware, great for large teams needing conventions and complex cross-feature client logic. More ceremony; RTK Query covers server state if you are already on Redux.
- **Zustand:** tiny, hook-based, selector subscriptions (only re-render on the slice you read), usable outside React. Less structure - teams must agree on conventions.

At **100+ screens**: most "global state" turns out to be server cache. Keep a query-key factory per feature, set `staleTime` per data type, invalidate by key prefix after mutations, colocate stores per feature (no god-store), and keep only genuinely shared client state global.

## Real-life example: the problem

A logistics back-office app. The Orders list was fetched once and copied into Redux. A dispatcher opens an order, changes its status to "Shipped", goes back - the list still says "Pending". A colleague's changes never appear until a full reload. Someone "fixed" it by re-fetching in five places, and now the list flickers and fires duplicate requests.

```jsx
// ordersSlice.js - server data cloned into client state
const ordersSlice = createSlice({
  name: 'orders',
  initialState: { items: [], loading: false, filter: 'all' },
  reducers: {
    setOrders: (s, a) => { s.items = a.payload; },
    setLoading: (s, a) => { s.loading = a.payload; },
    setFilter: (s, a) => { s.filter = a.payload; },
  },
});

function OrdersPage() {
  const dispatch = useDispatch();
  const { items, filter } = useSelector((s) => s.orders);
  useEffect(() => {
    if (items.length === 0) {                 // "cache": never refetches once filled
      dispatch(setLoading(true));
      fetch('/api/orders').then((r) => r.json()).then((d) => dispatch(setOrders(d)));
    }
  }, []);
  return <OrdersTable orders={items.filter((o) => filter === 'all' || o.status === filter)} />;
}

function OrderDetail({ id }) {
  const ship = () => fetch(`/api/orders/${id}/ship`, { method: 'POST' });  // list never learns about it
  /* ... */
}
```

Problems: a hand-rolled cache with no staleness, no invalidation, no dedup, no refetch on focus; the filter lives in Redux so it cannot be bookmarked or shared and is lost on reload.

## How to fix it

Server state in a query cache, filter in the URL, Redux/Zustand only for real client state.

```jsx
// orders/queries.js - one key factory per feature
export const orderKeys = {
  all: ['orders'],
  list: (status) => ['orders', 'list', { status }],
  detail: (id) => ['orders', 'detail', id],
};

export function useOrders(status) {
  return useQuery({
    queryKey: orderKeys.list(status),
    queryFn: ({ signal }) => fetch(`/api/orders?status=${status}`, { signal }).then((r) => r.json()),
    staleTime: 30_000,            // fresh for 30s, then revalidated in background on mount/focus
  });
}

export function useShipOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => fetch(`/api/orders/${id}/ship`, { method: 'POST' }).then((r) => r.json()),
    onSuccess: (updated) => {
      qc.setQueryData(orderKeys.detail(updated.id), updated);
      qc.invalidateQueries({ queryKey: orderKeys.all });   // every list variant refetches
    },
  });
}

// OrdersPage.jsx - filter lives in the URL
function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'all';
  const { data = [], isPending, error } = useOrders(status);
  /* ... setParams({ status: 'pending' }) on filter change ... */
}

// ui store (Zustand) - only true client state
export const useUiStore = create((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
```

Why it works: the backend stays the single source of truth; the query cache knows how old each entry is, dedups concurrent requests, refetches on window focus, and invalidation by key prefix updates every list after the mutation. The URL makes filters shareable. Redux is no longer a stale copy of the database. If the team is already invested in Redux, RTK Query with `providesTags`/`invalidatesTags` achieves the same.

## How to say it in the interview

- "I first split state into server, URL, form and client state. Server state goes into a cache library, filters into the URL, forms stay local, and only the small remainder needs Redux or Zustand."
- "Context is for dependency injection of low-frequency values; it re-renders every consumer and has no selectors, so it is a poor fit for fast-changing global state."
- Trap: copying fetched data into Redux/`useState` creates a second source of truth that goes stale. Follow-up: "How do you scale this?" - feature-owned query key factories, per-type `staleTime`, prefix invalidation, optimistic updates for snappy mutations.
- Trade-off: Redux gives strong conventions and tooling at the cost of ceremony; Zustand is lighter but needs team discipline; a query library adds a dependency but deletes most hand-written loading/caching code.
