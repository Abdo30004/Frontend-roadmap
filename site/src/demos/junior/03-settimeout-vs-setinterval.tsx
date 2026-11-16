import { useEffect, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Note, Row, Stack, Stat, fakeRequest, useConsole } from '../../demo-kit';

export const scenario = 'A banking dashboard refreshes the account balance every second. The balance API is slow on mobile (0.3 to 2.6 s per request).';
export const task = 'Open the account page and watch the balance and "in flight" for a few seconds. Then go back, open it again, and watch the network log.';
export const solutionNote = 'Same card, but polling uses a recursive setTimeout and the effect cleans it up.';

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const MAX_LEAKED = 4;

interface Net {
  newPoller: () => number;
  fetchBalance: (poller: number) => Promise<{ amount: number }>;
  trackInterval: (id: ReturnType<typeof setInterval>) => void; // demo bookkeeping so Reset can clear leaks
  stopped: () => void;
}

function BalanceCard({ fixed, net }: { fixed: boolean; net: Net }) {
  const [balance, setBalance] = useState<number | null>(null);
  const prev = useRef<number | null>(null);
  const [wentBack, setWentBack] = useState(false);

  const show = (amount: number) => {
    setWentBack(prev.current !== null && amount < prev.current);
    prev.current = amount;
    setBalance(amount);
  };

  useEffect(() => {
    const poller = net.newPoller();
    if (!fixed) {
      // BROKEN: fires every second even if the last request is still pending, and is never cleared
      const id = setInterval(async () => {
        const data = await net.fetchBalance(poller);
        show(data.amount);
      }, 1000);
      net.trackInterval(id);
      return; // no cleanup
    }
    // FIXED: next request is scheduled 1 s AFTER the previous one finished
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    async function poll() {
      try {
        const data = await net.fetchBalance(poller);
        if (!stopped) show(data.amount);
      } finally {
        if (!stopped) timeoutId = setTimeout(poll, 1000);
      }
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timeoutId);
      net.stopped();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Stack gap={6}>
      <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Checking · ••••4821</span>
      <Row gap={10}>
        <strong style={{ fontSize: 26, color: wentBack ? 'var(--bad)' : 'var(--ink)', transition: 'color 200ms ease' }}>
          {balance === null ? 'Loading…' : money(balance)}
        </strong>
        {wentBack && <Badge tone="bad">↓ jumped back to an older value</Badge>}
      </Row>
    </Stack>
  );
}

function Dashboard({ fixed }: { fixed: boolean }) {
  const c = useConsole(40);
  const [open, setOpen] = useState(false);
  const [inFlight, setInFlight] = useState(0);
  const [pollers, setPollers] = useState(0);
  const [outOfOrder, setOutOfOrder] = useState(0);
  const seq = useRef(0);
  const nextPoller = useRef(0);
  const lastSeq = useRef(new Map<number, number>());
  const intervals = useRef(new Set<ReturnType<typeof setInterval>>());
  const gen = useRef(0);

  const clearAll = () => {
    intervals.current.forEach((id) => clearInterval(id));
    intervals.current.clear();
  };
  useEffect(() => clearAll, []);

  const net: Net = {
    newPoller: () => {
      setPollers((n) => n + 1);
      return ++nextPoller.current;
    },
    trackInterval: (id) => intervals.current.add(id),
    stopped: () => setPollers((n) => Math.max(0, n - 1)),
    fetchBalance: async (poller) => {
      const g = gen.current;
      const n = ++seq.current;
      const amount = 2400 + n * 15; // incoming payments: the real balance only goes up
      c.log(`→ GET /api/accounts/4821/balance  #${n} (poller ${poller})`, 'info');
      setInFlight((x) => x + 1);
      const data = await fakeRequest({ amount }, { delay: [300, 2600] });
      if (g !== gen.current) return data;
      setInFlight((x) => Math.max(0, x - 1));
      const last = lastSeq.current.get(poller) ?? 0;
      if (n < last) {
        setOutOfOrder((x) => x + 1);
        c.log(`← #${n} ${money(amount)} arrived AFTER #${last}: balance goes back`, 'bad');
      } else {
        c.log(`← #${n} ${money(amount)}`, 'good');
      }
      lastSeq.current.set(poller, Math.max(last, n));
      return data;
    },
  };

  const reset = () => {
    gen.current++;
    clearAll();
    setOpen(false); setInFlight(0); setPollers(0); setOutOfOrder(0);
    lastSeq.current.clear();
    c.clear();
  };

  const capped = !fixed && !open && pollers >= MAX_LEAKED;

  return (
    <Stack gap={14}>
      <Browser url={open ? 'bank.example/accounts/4821' : 'bank.example/home'}>
        <Stack gap={12}>
          {open ? <BalanceCard fixed={fixed} net={net} /> : <Note>Home · Offers · Settings (no balance on this page)</Note>}
          <Row>
            {open
              ? <Button onClick={() => setOpen(false)}>← Back to home</Button>
              : <Button tone="primary" onClick={() => setOpen(true)} disabled={capped}>Open account page</Button>}
            <Button tone="ghost" onClick={reset}>Reset</Button>
          </Row>
          {capped && <Note>Demo cap: {MAX_LEAKED} pollers. Press Reset to clear them.</Note>}
        </Stack>
      </Browser>
      <Row gap={10}>
        <Stat label="requests in flight" value={inFlight} tone={inFlight > 1 ? 'bad' : 'neutral'} />
        <Stat label="out-of-order updates" value={outOfOrder} tone={outOfOrder > 0 ? 'bad' : 'good'} />
        <Stat label="pollers running" value={pollers} tone={pollers > (open ? 1 : 0) ? 'bad' : 'good'} />
      </Row>
      <Code>{fixed
        ? `async function poll() {\n  try { setBalance((await getBalance()).amount); }\n  finally { if (!stopped) id = setTimeout(poll, 1000); }\n}\npoll();\nreturn () => { stopped = true; clearTimeout(id); };`
        : `useEffect(() => {\n  setInterval(async () => {\n    setBalance((await getBalance()).amount);\n  }, 1000);\n  // no cleanup\n}, []);`}</Code>
      <Console lines={c.lines} height={140} title="Network" onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <Dashboard fixed={false} />;
}

export function Solution() {
  return <Dashboard fixed />;
}
