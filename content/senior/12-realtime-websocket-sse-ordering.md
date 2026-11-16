# Real-Time Features: WebSockets vs SSE, Reconnection and Message Ordering

**Level:** Senior
**Merged from (original phrasings):**
- Explain your strategy for implementing real-time features (WebSockets, Server-Sent Events).
- WebSocket messages arrive out of order. What should the client do?

## The concept (short answer)

**Choosing the transport**
- **Polling / long polling:** low-frequency updates (every 30s+), simplest infra, works everywhere. Good enough more often than people admit.
- **Server-Sent Events (SSE):** one-way server -> client over plain HTTP (`EventSource`). Built-in auto-reconnect and `Last-Event-ID` resume, works with HTTP/2, proxies, auth cookies. Ideal for notifications, live feeds, dashboards, LLM token streaming. Client -> server goes through normal HTTP requests.
- **WebSockets:** full-duplex, low latency, binary support. Needed for chat with typing indicators, collaborative editing, multiplayer, trading. You own reconnection, heartbeats, auth on connect, and sticky/stateful infra.

**Reliability strategy (either transport)**
- **Reconnect with exponential backoff + jitter**, plus heartbeats (ping/pong) to detect dead connections; pause when offline/hidden, resume on `online`/`visibilitychange`.
- **Ordering:** TCP keeps order *within one connection*, but messages still arrive "out of order" in practice: multiple backend instances publishing through a pub/sub, reconnecting to a different node, a REST snapshot racing with live events, or async handlers. The fix is a **per-stream monotonic sequence number (or version)** from the server.
- **Client algorithm:** keep `lastSeq`. `seq <= lastSeq` -> duplicate, ignore. `seq === lastSeq + 1` -> apply, then drain buffered successors. `seq > lastSeq + 1` -> **buffer** and wait briefly; if the gap is not filled in time, **refetch a snapshot** (with its seq) and resume from there. On reconnect, ask the server to resume from `lastSeq`.
- **Idempotent handlers:** applying the same event twice must not double anything (upsert by id, last-write-wins by version) - at-least-once delivery is the realistic guarantee.

## Real-life example: the problem

A food-delivery app's live order tracker. Users report the status going backwards: "Courier picked up" flips back to "Preparing", and the courier pin jumps backwards on the map. After a subway tunnel (network drop), the tracker freezes until the app is reopened; in the support chat, some messages appear twice. The backend runs three instances that publish via Redis pub/sub; status updates from the restaurant service and courier service can overtake each other.

```js
// Naive client: last message wins, no reconnect, no dedup
function useOrderTracking(orderId) {
  const [order, setOrder] = useState(null);
  useEffect(() => {
    fetch(`/api/orders/${orderId}`).then((r) => r.json()).then(setOrder);   // races with the socket
    const ws = new WebSocket(`wss://rt.example.com/orders/${orderId}`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      setOrder((o) => ({ ...o, ...msg.patch }));      // older event can overwrite newer state
      if (msg.type === 'chat') appendChat(msg.message); // duplicates after server retry
    };
    return () => ws.close();                            // and onclose? nothing: stays dead
  }, [orderId]);
  return order;
}
```

## How to fix it

Server contract: every event on the `order:{id}` stream carries `seq` (monotonic per order), snapshots carry the `seq` they reflect, and the socket accepts `?since=<seq>` to replay missed events.

```js
class OrderStream {
  constructor(orderId, onState) {
    Object.assign(this, { orderId, onState, state: null, lastSeq: -1, buffer: new Map(), attempt: 0 });
    this.connect();
  }

  async loadSnapshot() {
    const res = await fetch(`/api/orders/${this.orderId}`);       // { seq, order, chat: [...] }
    const snap = await res.json();
    this.state = snap;
    this.lastSeq = snap.seq;
    for (const s of [...this.buffer.keys()]) if (s <= this.lastSeq) this.buffer.delete(s);
    this.drain();
    this.onState(this.state);
  }

  connect() {
    const since = this.lastSeq >= 0 ? `?since=${this.lastSeq}` : '';
    this.ws = new WebSocket(`wss://rt.example.com/orders/${this.orderId}${since}`);
    this.ws.onopen = () => { this.attempt = 0; if (this.lastSeq < 0) this.loadSnapshot(); };
    this.ws.onmessage = (e) => this.receive(JSON.parse(e.data));
    this.ws.onclose = () => { if (!this.closed) this.reconnect(); };
  }

  reconnect() {
    const delay = Math.random() * Math.min(30_000, 500 * 2 ** this.attempt++); // backoff + full jitter
    this.timer = setTimeout(() => this.connect(), delay);
  }

  receive(event) {
    if (event.seq <= this.lastSeq || this.buffer.has(event.seq)) return;      // duplicate
    this.buffer.set(event.seq, event);
    if (this.lastSeq < 0) return;                                             // snapshot pending
    this.drain();
    if (this.buffer.size > 0 && !this.gapTimer) {                             // gap detected
      this.gapTimer = setTimeout(() => { this.gapTimer = null; this.loadSnapshot(); }, 2000);
    }
  }

  drain() {
    let next;
    while ((next = this.buffer.get(this.lastSeq + 1))) {
      this.buffer.delete(next.seq);
      this.state = applyEvent(this.state, next);                              // pure + idempotent
      this.lastSeq = next.seq;
    }
    if (this.buffer.size === 0 && this.gapTimer) { clearTimeout(this.gapTimer); this.gapTimer = null; }
    this.onState(this.state);
  }

  close() { this.closed = true; clearTimeout(this.timer); clearTimeout(this.gapTimer); this.ws.close(); }
}

function applyEvent(state, e) {
  switch (e.type) {
    case 'status': return { ...state, order: { ...state.order, status: e.status } };
    case 'courier_location': return { ...state, order: { ...state.order, courier: e.position } };
    case 'chat':  // upsert by message id: a redelivered message cannot duplicate
      return state.chat.some((m) => m.id === e.message.id) ? state : { ...state, chat: [...state.chat, e.message] };
    default: return state;
  }
}

function useOrderTracking(orderId) {
  const [state, setState] = useState(null);
  useEffect(() => {
    const stream = new OrderStream(orderId, setState);
    return () => stream.close();
  }, [orderId]);
  return state;
}
```

Why it works: the sequence number gives the client a total order per order stream regardless of which server instance sent what. Duplicates are dropped, early events wait in the buffer, and a persistent gap is healed by a snapshot that carries its own `seq`, so live events and the snapshot can never clobber each other. Reconnects resume from `lastSeq` with jittered backoff (no thundering herd after a server restart). Handlers are idempotent, so at-least-once delivery is safe. For high-frequency, last-value data like the courier position you can skip strict ordering and just drop anything with an older timestamp/version. If this tracker were one-way only, SSE would give reconnect and `Last-Event-ID` resume for free:

```js
const es = new EventSource(`/api/orders/${orderId}/events`); // server sets `id: <seq>` on each event
es.addEventListener('status', (e) => stream.receive(JSON.parse(e.data)));
```

## How to say it in the interview

- "Default to SSE for server-to-client streams and WebSockets only when I need bidirectional low-latency traffic; polling for low-frequency data."
- "Ordering is solved with server-assigned per-stream sequence numbers: ignore duplicates, buffer ahead-of-order events, refetch a versioned snapshot on a persistent gap, and resume from the last seq on reconnect."
- Trap: "TCP guarantees order, so it can't happen" - order breaks across server instances, reconnects and snapshot/live races. Follow-up: scaling WebSockets - sticky sessions or a pub/sub fan-out (Redis, NATS), connection limits per node, auth token expiry on long-lived connections.
- Trade-off: strict ordering with buffering adds latency and memory; for last-value-wins data (positions, prices) use versions and drop stale updates instead of reordering.
