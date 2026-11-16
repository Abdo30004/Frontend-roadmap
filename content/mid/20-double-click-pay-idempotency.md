# A user double-clicks "Pay". How do you stop the duplicate request?

**Level:** Mid
**Merged from (original phrasings):**
- A user double-clicks "Pay." How do you stop the duplicate request?

## The concept (short answer)
- **Two layers, and both are required.**
  1. **Client:** prevent the second submit. Use a synchronous in-flight guard (a `useRef` set at the very top of the handler, before any `await`). `disabled={loading}` only takes effect after a re-render, so any `await` before `setLoading(true)` (validation, a token refresh, a 3-D Secure check) leaves a window where a second click gets through. Also disable the button and show "Processing...".
  2. **Server:** make the operation **idempotent** with an **idempotency key**. The client generates a unique key (`crypto.randomUUID()`) once per checkout attempt and sends it with every retry. The server stores the key with the result and, if it sees the key again, returns the original result instead of charging again.
- **Why the client fix alone is not enough:** retries on network timeouts (the request succeeded but the response was lost), users refreshing or pressing Back and resubmitting, two open tabs, proxies or libraries retrying, and anyone with curl. Only the server can guarantee "exactly one charge".
- Payment providers support this directly (for example Stripe's `Idempotency-Key` header). Your own API should support the same pattern for any non-idempotent POST: orders, transfers, bookings.
- Debounce or throttle is **not** the right tool for this: it delays or drops clicks based on time and guarantees nothing.

## Real-life example: the problem
On a ticketing site, during a concert presale the payment API is slow (4-6 s). Users double-click "Pay" or click again because nothing seems to happen. Support receives dozens of complaints about being charged twice for the same tickets, and chargebacks increase. The developer had added `disabled={loading}`, yet duplicates still happen. The handler first awaits a cart check (~300 ms) before it sets `loading`, so a second click during that await starts a second payment. Network-timeout retries in the API client also resend the POST, and users who refresh or retry from another tab create new charges.

```jsx
function PayButton({ cartId, amount }) {
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    if (loading) return;
    await api.get(`/carts/${cartId}/check`); // ~300 ms: the button is still enabled during this await
    setLoading(true);              // too late: a second click already started another payment
    await api.post('/payments', { cartId, amount }, { retry: 2 }); // retries create new charges
    setLoading(false);
    router.push('/confirmation');
  }

  return <button onClick={handlePay} disabled={loading}>Pay {amount} EUR</button>;
}
```

```js
// server: charges every request it receives
app.post('/payments', async (req, res) => {
  const charge = await psp.charge(req.body.cartId, req.body.amount);
  res.json({ status: 'paid', chargeId: charge.id });
});
```

## How to fix it
**Client:**
```jsx
function PayButton({ cartId, amount }) {
  const [status, setStatus] = useState('idle'); // idle | processing | error
  const inFlight = useRef(false);
  // One key per checkout attempt; reused by retries, regenerated only for a new attempt
  const idempotencyKey = useRef(crypto.randomUUID());

  async function handlePay() {
    if (inFlight.current) return;   // synchronous guard, set before any await
    inFlight.current = true;
    setStatus('processing');
    try {
      await api.post('/payments', { cartId, amount }, {
        headers: { 'Idempotency-Key': idempotencyKey.current },
        retry: 2,                    // retries are now safe: same key
      });
      router.push('/confirmation');
    } catch (err) {
      setStatus('error');
      inFlight.current = false;      // allow a retry with the SAME key
    }
  }

  return (
    <button onClick={handlePay} disabled={status === 'processing'} aria-busy={status === 'processing'}>
      {status === 'processing' ? 'Processing payment...' : `Pay ${amount} EUR`}
    </button>
  );
}
```

**Server:**
```js
app.post('/payments', async (req, res) => {
  const key = req.get('Idempotency-Key');
  if (!key) return res.status(400).json({ error: 'Idempotency-Key required' });

  // Atomic insert: a unique constraint on (user_id, key) makes concurrent duplicates fail here
  const inserted = await db.idempotency.insertIfAbsent({
    userId: req.user.id, key, requestHash: hash(req.body), status: 'processing',
  });

  if (!inserted) {
    const existing = await db.idempotency.find(req.user.id, key);
    if (existing.requestHash !== hash(req.body)) return res.status(422).json({ error: 'Key reused with different payload' });
    if (existing.status === 'processing') return res.status(409).json({ error: 'Payment in progress' });
    return res.status(existing.httpStatus).json(existing.response); // replay the original result
  }

  const charge = await psp.charge(req.body.cartId, req.body.amount, { idempotencyKey: key });
  const response = { status: 'paid', chargeId: charge.id };
  await db.idempotency.complete(req.user.id, key, { httpStatus: 200, response });
  res.json(response);
});
```

Why it works: the ref blocks a second click synchronously, before any re-render. The disabled button and the "Processing..." label stop users clicking again. On the server, the unique constraint means only one request per key can create a charge: any duplicate, whether from a double click, a retry, a second tab or a refresh, gets the stored result or a 409. Passing the same key to the payment provider protects the last hop too. Keys expire after about 24 h.

Alternative for plain forms: the Post/Redirect/Get pattern plus a one-time form token. In React 19, `useActionState`/`useFormStatus` give you `pending` for the button, but they still don't replace server idempotency.

## How to say it in the interview
- "Disabling the button is UX, not correctness. I add a synchronous ref guard on the client and an idempotency key enforced by a unique constraint on the server."
- "The key is created once per checkout attempt and reused on retries. A new key on every click would defeat the purpose."
- Follow-up: "Why not just check `if (loading)`?" `setState` is async and the closure is stale, so two clicks in the same tick both pass. A ref updates synchronously.
- Trade-off: you need storage and a TTL for keys and must handle the "still processing" state (return 409 or wait), but that is much cheaper than refunds and chargebacks.
