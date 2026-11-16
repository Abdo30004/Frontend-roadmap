# What is BFF (Backend for Frontend)?

**Level:** Mid
**Merged from (original phrasings):**
- What is BFF (Backend for Frontend)?

## The concept (short answer)
- A **BFF** is a thin server layer **owned by the frontend team** and built for **one specific client** (web app, mobile app, smart TV). It sits between that UI and the general-purpose backend services or microservices.
- It **aggregates and shapes** data: one call from the browser instead of 5-10 calls to different services. It returns exactly the fields the screen needs, so payloads are smaller and there is no client-side over-fetching or waterfalls.
- It is a **security boundary**: secrets, service tokens and third-party API keys stay on the server. The browser gets an httpOnly session cookie, and the BFF exchanges it for access tokens (the "token handler" pattern).
- It **decouples** the UI from backend changes: when a service renames a field or splits into two, only the BFF mapping changes.
- Typical implementations: Next.js Route Handlers or Server Components/Server Actions, a Node/Express/Fastify service, or a GraphQL gateway.
- It should not contain core business logic (pricing rules, permissions). That stays in the domain services, otherwise web and mobile drift apart.

## Real-life example: the problem
A food-delivery web app's home screen needs the user profile, saved addresses, nearby restaurants, active promotions and the current order status. The React app calls five microservices directly. On mid-range phones over 4G, the home screen takes about 4 s: the restaurant call waits for the address call (a waterfall), restaurant payloads include full menus (900 KB) when the screen only shows name, rating and ETA, and the promotions service needs a partner API key that is shipped in the JS bundle.

```jsx
// HomeScreen.jsx: browser orchestrates 5 services
useEffect(() => {
  (async () => {
    const user = await fetch('https://users.api.example.com/me', { credentials: 'include' }).then(r => r.json());
    const addresses = await fetch(`https://users.api.example.com/${user.id}/addresses`).then(r => r.json());
    const restaurants = await fetch(
      `https://catalog.api.example.com/restaurants?lat=${addresses[0].lat}&lng=${addresses[0].lng}`
    ).then(r => r.json());                                   // 900 KB, full menus included
    const promos = await fetch('https://partner-promos.example.com/v2/offers', {
      headers: { 'X-Api-Key': import.meta.env.VITE_PROMO_KEY }, // secret leaked into the bundle
    }).then(r => r.json());
    const order = await fetch(`https://orders.api.example.com/active?user=${user.id}`).then(r => r.json());
    setState({ user, restaurants, promos, order });
  })();
}, []);
```

Problems: sequential network round trips from a slow device, oversized payloads, a leaked secret, CORS configured on five services, and every backend change breaks the UI.

## How to fix it
Add a BFF endpoint shaped for the home screen (Next.js Route Handler shown here):

```js
// app/api/home/route.js: runs on the server, close to the services
import { cookies } from 'next/headers';
import { getAccessToken } from '@/server/auth';

export async function GET() {
  const token = await getAccessToken((await cookies()).get('session')?.value);
  if (!token) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const [user, addresses, order] = await Promise.all([
    fetch(`${USERS_URL}/me`, auth).then(r => r.json()),
    fetch(`${USERS_URL}/me/addresses`, auth).then(r => r.json()),
    fetch(`${ORDERS_URL}/me/active`, auth).then(r => r.json()),
  ]);

  const { lat, lng } = addresses[0] ?? {};
  const [restaurants, promos] = await Promise.allSettled([
    fetch(`${CATALOG_URL}/restaurants?lat=${lat}&lng=${lng}&fields=id,name,rating,eta,imageUrl`).then(r => r.json()),
    fetch(`${PROMOS_URL}/v2/offers`, { headers: { 'X-Api-Key': process.env.PROMO_KEY } }).then(r => r.json()),
  ]);

  return Response.json({
    greetingName: user.firstName,
    activeOrder: order ? { id: order.id, status: order.status, eta: order.eta } : null,
    restaurants: restaurants.status === 'fulfilled' ? restaurants.value.slice(0, 20) : [],
    promos: promos.status === 'fulfilled' ? promos.value.map(p => ({ id: p.id, title: p.title })) : [], // degrade gracefully
  });
}
```

```jsx
// HomeScreen.jsx: one same-origin request
const { data } = useQuery({ queryKey: ['home'], queryFn: () => fetch('/api/home').then(r => r.json()) });
```

Why it works: the fan-out happens server-to-server over a fast internal network and in parallel. The browser makes one same-origin request (no CORS, the cookie is sent automatically) and receives a small payload shaped for the screen. The partner key never leaves the server. If the promos service is down, the home screen still renders.

Alternatives: a GraphQL gateway (clients pick fields themselves, which works well when there are many different screens); a generic API gateway handles routing, rate limiting and auth but does not shape data per client.

## How to say it in the interview
- "A BFF is a backend per frontend experience, owned by the UI team, that aggregates services, shapes responses for the screen, and keeps secrets and tokens off the client."
- "In Next.js the BFF is often built in: Route Handlers, Server Components and Server Actions already run on the server."
- Trap/follow-up: "Isn't that just another hop?" Yes, but one browser-to-BFF round trip plus parallel internal calls beats several sequential round trips from a phone. Watch the BFF's own latency and add timeouts.
- Trade-off: one more service to deploy, monitor and scale, and a risk of business logic creeping into it and being duplicated between the web and mobile BFFs.
