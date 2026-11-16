import { useEffect, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Resettable, Row, Stack, Stat, fakeRequest, useConsole } from '../../demo-kit';

export const scenario =
  'A food-delivery app tracks an order live over a WebSocket; restaurant and courier services publish updates through several server instances.';
export const task = 'Press "Start order" and watch the status. Run it again and press "Enter tunnel" midway (2.5s without network).';
export const solutionNote = 'Same socket, but events carry seq: duplicates dropped, early ones buffered, and a snapshot is refetched after a gap or reconnect.';

const STATUSES = ['Placed', 'Confirmed', 'Preparing', 'Picked up', 'Out for delivery', 'Delivered'];
type Ev = { seq: number; type: 'status'; status: number } | { seq: number; type: 'chat'; id: string; text: string };
// emitted every 500ms; latency differs per path (restaurant vs courier service, 3 instances)
const EVENTS: { ev: Ev; latency: number; dup?: number }[] = [
  { ev: { seq: 1, type: 'status', status: 1 }, latency: 200 },
  { ev: { seq: 2, type: 'status', status: 2 }, latency: 900 },
  { ev: { seq: 3, type: 'status', status: 3 }, latency: 150 },
  { ev: { seq: 4, type: 'chat', id: 'm1', text: 'Courier: On my way!' }, latency: 250, dup: 700 },
  { ev: { seq: 5, type: 'status', status: 4 }, latency: 1200 },
  { ev: { seq: 6, type: 'chat', id: 'm2', text: "Courier: I'm outside" }, latency: 200 },
  { ev: { seq: 7, type: 'status', status: 5 }, latency: 100 },
];
interface View { status: number; chat: { id: string; text: string }[] }
const apply = (s: View, e: Ev): View =>
  e.type === 'status' ? { ...s, status: e.status }
    : s.chat.some((m) => m.id === e.id) ? s : { ...s, chat: [...s.chat, { id: e.id, text: e.text }] }; // upsert by id

function Tracker({ fixed, reset }: { fixed: boolean; reset: () => void }) {
  const c = useConsole();
  const [view, setView] = useState<View>({ status: 0, chat: [] });
  const [conn, setConn] = useState<'idle' | 'open' | 'closed' | 'reconnecting'>('idle');
  const [regressions, setRegressions] = useState(0);
  const [started, setStarted] = useState(false);
  const [emitted, setEmitted] = useState(0);
  const timers = useRef(new Set<number>());
  const net = useRef({ up: true, socketId: 0, open: false });
  const server = useRef<Ev[]>([]);                        // events emitted so far (server truth)
  const client = useRef({ state: { status: 0, chat: [] } as View, lastSeq: 0, buffer: new Map<number, Ev>(), gapTimer: 0 });

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.current.delete(id); fn(); }, ms);
    timers.current.add(id);
    return id;
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const commit = (next: View) => {
    const prev = client.current.state;
    if (next.status < prev.status) {
      setRegressions((r) => r + 1);
      c.log(`status went BACKWARDS: ${STATUSES[prev.status]} → ${STATUSES[next.status]}`, 'bad');
    }
    client.current.state = next;
    setView(next);
  };

  const loadSnapshot = async () => {
    c.log('GET /orders/4821 (snapshot)', 'info');
    const snap = await fakeRequest(() => ({ seq: server.current.length, events: [...server.current] }), { delay: 300 });
    const cl = client.current;
    const state = snap.events.reduce(apply, { status: 0, chat: [] } as View);
    cl.lastSeq = snap.seq;
    for (const s of [...cl.buffer.keys()]) if (s <= cl.lastSeq) cl.buffer.delete(s);
    c.log(`snapshot applied at seq ${snap.seq}`, 'good');
    commit(state);
    drain();
  };

  const drain = () => {
    const cl = client.current;
    let next = cl.state;
    while (cl.buffer.has(cl.lastSeq + 1)) {
      const e = cl.buffer.get(cl.lastSeq + 1)!;
      cl.buffer.delete(e.seq); next = apply(next, e); cl.lastSeq = e.seq;
    }
    if (next !== cl.state) commit(next);
    if (cl.buffer.size === 0) { clearTimeout(cl.gapTimer); cl.gapTimer = 0; }
    else if (!cl.gapTimer) cl.gapTimer = later(() => { cl.gapTimer = 0; void loadSnapshot(); }, 1500);
  };

  const receive = (e: Ev) => {
    const label = e.type === 'status' ? STATUSES[e.status] : e.text;
    if (!fixed) {                                          // last message wins, chat appended blindly
      c.log(`← seq ${e.seq} ${label}`);
      const s = client.current.state;
      commit(e.type === 'status' ? { ...s, status: e.status } : { ...s, chat: [...s.chat, { id: e.id, text: e.text }] });
      return;
    }
    const cl = client.current;
    if (e.seq <= cl.lastSeq || cl.buffer.has(e.seq)) { c.log(`← seq ${e.seq} duplicate, dropped`, 'warn'); return; }
    c.log(`← seq ${e.seq} ${label}${e.seq > cl.lastSeq + 1 ? ` (buffered, waiting for ${cl.lastSeq + 1})` : ''}`);
    cl.buffer.set(e.seq, e);
    drain();
  };

  const connect = (attempt: number) => {
    if (!net.current.up) {
      const delay = Math.round(Math.random() * Math.min(4000, 400 * 2 ** attempt)); // backoff + jitter
      c.log(`reconnect failed, retry in ${delay}ms`, 'warn');
      later(() => connect(attempt + 1), delay);
      return;
    }
    net.current = { ...net.current, socketId: net.current.socketId + 1, open: true };
    setConn('open');
    if (attempt > 0) { c.log('socket reopened', 'good'); void loadSnapshot(); }
  };

  const send = (e: Ev, latency: number) => {
    if (!net.current.open) return;                          // socket down: event is lost for this client
    const id = net.current.socketId;
    later(() => { if (net.current.open && net.current.socketId === id) receive(e); }, latency + Math.random() * 40);
  };

  const start = () => {
    timers.current.forEach(clearTimeout); timers.current.clear();
    server.current = []; client.current = { state: { status: 0, chat: [] }, lastSeq: 0, buffer: new Map(), gapTimer: 0 };
    setView({ status: 0, chat: [] }); setRegressions(0); setEmitted(0); c.clear(); setStarted(true);
    net.current = { up: true, socketId: 0, open: false };
    connect(0);
    EVENTS.forEach(({ ev, latency, dup }) => later(() => {
      server.current.push(ev);
      setEmitted(server.current.length);
      send(ev, latency);
      if (dup) send(ev, dup);                               // at-least-once: the server retried
    }, ev.seq * 500));
  };

  const tunnel = () => {
    net.current = { ...net.current, up: false, open: false };
    setConn('closed');
    c.log('✕ network lost (tunnel): socket closed', 'bad');
    later(() => { net.current.up = true; c.log('network is back', 'info'); }, 2500);
    if (fixed) { setConn('reconnecting'); later(() => connect(1), 300); }
  };

  const final = emitted === EVENTS.length;
  const truth = server.current.reduce(apply, { status: 0, chat: [] } as View);
  const dupes = view.chat.length - new Set(view.chat.map((m) => m.id)).size;
  const inSync = view.status === truth.status && view.chat.length === truth.chat.length;

  return (
    <Stack gap={12}>
      <Browser url="eats.example/orders/4821/track">
        <Stack gap={10}>
          <Row gap={6}>
            {STATUSES.map((s, i) => (
              <Badge key={s} tone={i === view.status ? 'info' : i < view.status ? 'good' : 'neutral'}>{i <= view.status ? '● ' : '○ '}{s}</Badge>
            ))}
          </Row>
          <Stack gap={4}>
            {view.chat.length === 0 ? <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>No messages yet</span>
              : view.chat.map((m, i) => <span key={i} style={{ fontSize: 13 }}>💬 {m.text}</span>)}
          </Stack>
        </Stack>
      </Browser>

      <Row gap={6}>
        <Button tone="primary" onClick={start}>Start order</Button>
        <Button onClick={tunnel} disabled={!started || conn !== 'open'}>Enter tunnel</Button>
        <Button tone="ghost" onClick={reset}>Reset</Button>
        <Badge tone={conn === 'open' ? 'good' : conn === 'idle' ? 'neutral' : 'bad'}>socket: {conn}</Badge>
      </Row>

      <Row gap={8}>
        <Stat label="status went backwards" value={regressions} tone={regressions ? 'bad' : 'neutral'} />
        <Stat label="duplicate chat messages" value={dupes} tone={dupes ? 'bad' : 'neutral'} />
        <Stat label="matches server" value={!started ? '—' : inSync ? 'yes' : final ? 'no (stale)' : '…'} tone={!started ? 'neutral' : inSync ? 'good' : final ? 'bad' : 'neutral'} />
      </Row>

      <Code>{fixed
        ? `if (e.seq <= lastSeq || buffer.has(e.seq)) return; // duplicate\nbuffer.set(e.seq, e); drain();                // apply lastSeq+1 in order\nif (buffer.size) gapTimer = setTimeout(loadSnapshot, 1500);\nws.onclose = () => reconnect(backoff + jitter) → loadSnapshot();`
        : `ws.onmessage = (e) => {\n  const msg = JSON.parse(e.data);\n  setOrder(o => ({ ...o, ...msg.patch }));  // last arrival wins\n};\n// ws.onclose: nothing`}</Code>
      <Console lines={c.lines} height={150} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <Resettable>{(reset) => <Tracker fixed={false} reset={reset} />}</Resettable>;
}

export function Solution() {
  return <Resettable>{(reset) => <Tracker fixed reset={reset} />}</Resettable>;
}
