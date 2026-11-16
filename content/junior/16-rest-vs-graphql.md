# What is the difference between REST and GraphQL?

**Level:** Junior
**Merged from (original phrasings):**
- Explain the difference between REST APIs and GraphQL.

## The concept (short answer)
- **REST** exposes many **resource URLs** (`/users/42`, `/users/42/orders`) and uses HTTP verbs (GET, POST, PUT/PATCH, DELETE) and status codes. The **server decides the shape** of each response.
- **GraphQL** exposes **one endpoint** (usually `POST /graphql`) with a typed **schema**. The **client sends a query describing exactly the fields it needs**, possibly across several related types, and gets exactly that shape back.
- REST problems GraphQL solves: **over-fetching** (getting 40 fields when you need 3) and **under-fetching** / multiple round trips (fetch user, then orders, then each product).
- REST strengths: simple, uses HTTP caching (CDN, browser, ETag) for free because each GET has its own URL, easy to secure and rate-limit per endpoint, great tooling everywhere.
- GraphQL costs: caching needs a client library (Apollo, urql, Relay) with a normalized cache; errors usually come back as HTTP 200 with an `errors` array; deeply nested queries can be expensive on the server (N+1 queries, need DataLoader and query depth/cost limits).
- Neither is "better": REST fits simple CRUD and public APIs; GraphQL fits complex, related data consumed by several clients (web, mobile) with different needs.

## Real-life example: the problem
A typical case: an e-commerce mobile app's "My orders" screen took 4-5 seconds to load on 3G. It made one request for the user, one for the order list, then one request **per order** to get product names and thumbnails (a classic waterfall / N+1 on the client). Each product response was 30 KB of JSON (full description, specs, reviews) although the screen only showed a name and a thumbnail.

```js
// REST, done naively: 2 + N sequential requests, mostly unused data
async function loadOrdersScreen(userId) {
  const user = await fetch(`/api/users/${userId}`).then((r) => r.json());
  const orders = await fetch(`/api/users/${userId}/orders`).then((r) => r.json());

  for (const order of orders) {
    // sequential: 20 orders = 20 extra round trips
    const product = await fetch(`/api/products/${order.productId}`).then((r) => r.json());
    order.productName = product.name;          // 30 KB fetched, 2 fields used
    order.thumbnail = product.images[0].url;
  }
  return { userName: user.firstName, orders };
}
```

## How to fix it
Option A: GraphQL, one round trip, exactly the fields needed.

```js
const ORDERS_SCREEN = /* GraphQL */ `
  query OrdersScreen($userId: ID!) {
    user(id: $userId) {
      firstName
      orders(last: 20) {
        id
        status
        total
        product { name thumbnailUrl }
      }
    }
  }
`;

async function loadOrdersScreen(userId) {
  const res = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: ORDERS_SCREEN, variables: { userId } }),
  });
  const { data, errors } = await res.json();
  if (errors?.length) throw new Error(errors[0].message); // HTTP is still 200!
  return data.user;
}
```

On the server, each resolver loads its field; `product` uses DataLoader so 20 orders trigger one batched DB query, not 20.

Option B: stay with REST but design for the screen.

```js
// 1) Parallelize instead of sequential awaits
const [user, orders] = await Promise.all([
  fetch(`/api/users/${userId}`).then((r) => r.json()),
  fetch(`/api/users/${userId}/orders?expand=product&fields=id,status,total,product.name,product.thumbnailUrl`)
    .then((r) => r.json()),
]);
// 2) or add a BFF ("backend for frontend") endpoint: GET /api/screens/orders
```

Why it works:
- GraphQL lets the client ask for nested related data in one request, so latency goes from 2 + N round trips to 1, and the payload drops from hundreds of KB to a few KB.
- The REST fix uses `Promise.all`, server-side `expand`/sparse fieldsets, or a BFF to get the same benefit while keeping HTTP caching.

Quick comparison:

| | REST | GraphQL |
|---|---|---|
| Endpoints | Many, one per resource | One |
| Response shape | Fixed by server | Chosen by client |
| Caching | HTTP/CDN out of the box | Client cache (Apollo/urql), persisted queries for CDN |
| Errors | HTTP status codes | Usually 200 + `errors` array |
| Typing | OpenAPI (optional) | Schema built in, codegen for TS types |
| Versioning | `/v1`, `/v2` | Evolve schema, `@deprecated` fields |

## How to say it in the interview
- "REST is resource-based with many endpoints and server-defined responses; GraphQL is one endpoint with a typed schema where the client asks for exactly the fields it needs, which removes over-fetching and multiple round trips."
- Be balanced: REST wins on simplicity and HTTP caching; GraphQL wins when screens need related data from many resources and when several clients need different shapes.
- Common trap: "GraphQL is faster." Not automatically; a bad resolver setup causes N+1 database queries, so you need DataLoader and query cost limits.
- Follow-up: error handling. Check the `errors` array, not just `res.ok`, because GraphQL often returns 200 with partial data.
