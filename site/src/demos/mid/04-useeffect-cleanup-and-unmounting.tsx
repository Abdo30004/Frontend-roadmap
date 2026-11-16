import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Note, Panel, Row, Stack, Stat, fakeRequest, useConsole, type Tone } from '../../demo-kit';

export const scenario = 'A ride-hailing app has a "Driver on the way" screen that polls the driver\'s location while it is open.';
export const task = 'Open the tracking screen, switch rides, close it, open it again a few times. Watch "active pollers" and the console.';
export const solutionNote = 'Same tracker, but the effect returns a cleanup: clear the interval, abort the request, remove the listener.';

type Ride = 'A' | 'B';
const DRIVERS: Record<Ride, { name: string; car: string }> = {
  A: { name: 'Marco', car: 'Grey Toyota Prius · KX-219' },
  B: { name: 'Lena', car: 'Blue Kia Niro · RT-884' },
};
const CAP = 8; // demo safety: never more than 8 leaked pollers at once

interface Loc { ride: Ride; progress: number }
interface Registry {
  add: (kind: 'poll' | 'listener', stop: () => void) => () => void;
  request: (ride: Ride) => void;
}

function DriverTracker({ rideId, fixed, reg }: { rideId: Ride; fixed: boolean; reg: Registry }) {
  const [pos, setPos] = useState<Loc | null>(null);

  useEffect(() => {
    let controller: AbortController | null = null;
    const poll = async () => {
      controller?.abort();
      controller = new AbortController();
      reg.request(rideId);
      try {
        const loc = await fakeRequest<Loc>(() => ({ ride: rideId, progress: Math.random() }), { delay: 250, signal: controller.signal });
        setPos(loc); // an old interval writes the OLD ride's driver here
      } catch { /* aborted */ }
    };
    poll();
    const id = setInterval(poll, 1000);
    const onVisibility = () => { if (document.hidden) clearInterval(id); };
    document.addEventListener('visibilitychange', onVisibility);

    // (The registry only lets the demo count and Reset what is still running.)
    const stopPoll = reg.add('poll', () => { clearInterval(id); controller?.abort(); });
    const stopListener = reg.add('listener', () => document.removeEventListener('visibilitychange', onVisibility));

    if (!fixed) return; // BUG: no cleanup. Interval + listener live forever.
    return () => { stopPoll(); stopListener(); };
  }, [rideId]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = pos ? DRIVERS[pos.ride] : null;
  const wrong = pos !== null && pos.ride !== rideId;
  return (
    <Panel title={`Ride ${rideId} · driver on the way`} tone={wrong ? 'bad' : undefined}>
      {shown && pos ? (
        <Stack gap={8}>
          <Row gap={8}>
            <strong>{shown.name}</strong>
            <Badge tone={wrong ? 'bad' : 'good'}>{wrong ? `driver of ride ${pos.ride}!` : 'your driver'}</Badge>
          </Row>
          <Note>{shown.car}</Note>
          <div style={{ position: 'relative', height: 8, borderRadius: 99, background: 'var(--paper-2)' }}>
            <span style={{ position: 'absolute', inset: 0, transform: `translateX(${Math.round(pos.progress * 90)}%)`, transition: 'transform 300ms ease' }}>
              <span style={{ position: 'absolute', top: -3, left: 0, width: 14, height: 14, borderRadius: '50%', background: wrong ? 'var(--bad)' : 'var(--accent)' }} />
            </span>
          </div>
        </Stack>
      ) : <Note>Locating your driver…</Note>}
    </Panel>
  );
}

function RideApp({ fixed }: { fixed: boolean }) {
  const [open, setOpen] = useState(false);
  const [ride, setRide] = useState<Ride>('A');
  const [counts, setCounts] = useState({ polls: 0, listeners: 0, requests: 0 });
  const items = useRef(new Map<number, { kind: 'poll' | 'listener'; stop: () => void }>());
  const nextId = useRef(0);
  const openRef = useRef(open);
  const rideRef = useRef(ride);
  openRef.current = open;
  rideRef.current = ride;
  const c = useConsole(40);

  const reg = useMemo<Registry>(() => {
    const sync = () => {
      let polls = 0, listeners = 0;
      items.current.forEach((i) => (i.kind === 'poll' ? polls++ : listeners++));
      setCounts((s) => ({ ...s, polls, listeners }));
    };
    return {
      add(kind, stop) {
        const id = nextId.current++;
        items.current.set(id, { kind, stop });
        const same = [...items.current].filter(([, v]) => v.kind === kind);
        if (same.length > CAP) { same[0][1].stop(); items.current.delete(same[0][0]); } // demo cap
        sync();
        return () => {
          const it = items.current.get(id);
          if (it) { it.stop(); items.current.delete(id); sync(); }
        };
      },
      request(r) {
        setCounts((s) => ({ ...s, requests: s.requests + 1 }));
        const stale = !openRef.current || rideRef.current !== r;
        const tone: Tone = stale ? 'bad' : 'neutral';
        c.log(`GET /api/rides/${r}/driver-location${!openRef.current ? '   (screen is closed!)' : stale ? '   (old ride!)' : ''}`, tone);
      },
    };
  }, [c.log]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => items.current.forEach((i) => i.stop()), []); // the demo itself never leaks after you leave the page

  const reset = () => {
    items.current.forEach((i) => i.stop());
    items.current.clear();
    setOpen(false);
    setCounts({ polls: 0, listeners: 0, requests: 0 });
    c.clear();
  };

  const expected = open ? 1 : 0;
  return (
    <Stack gap={12}>
      <Browser url="ride.example/trips/current">
        <Stack gap={10}>
          <Row gap={8}>
            <Button tone="primary" onClick={() => setOpen((o) => !o)}>{open ? 'Close tracking' : 'Open tracking'}</Button>
            <Button onClick={() => setRide((r) => (r === 'A' ? 'B' : 'A'))} disabled={!open}>Switch to ride {ride === 'A' ? 'B' : 'A'}</Button>
            <Button tone="ghost" onClick={reset}>Reset</Button>
          </Row>
          {open ? <DriverTracker rideId={ride} fixed={fixed} reg={reg} /> : <Note>Tracking screen is closed.</Note>}
        </Stack>
      </Browser>
      <Row gap={8}>
        <Stat label={`active pollers (expected ${expected})`} value={counts.polls} tone={counts.polls > expected ? 'bad' : 'good'} />
        <Stat label="visibilitychange listeners" value={counts.listeners} tone={counts.listeners > expected ? 'bad' : 'good'} />
        <Stat label="requests sent" value={counts.requests} />
      </Row>
      <Code>{fixed
        ? `const id = setInterval(poll, 1000);\ndocument.addEventListener('visibilitychange', onVisibility);\nreturn () => {\n  clearInterval(id); controller?.abort();\n  document.removeEventListener('visibilitychange', onVisibility);\n};`
        : `const id = setInterval(poll, 1000);\ndocument.addEventListener('visibilitychange', () => {\n  if (document.hidden) clearInterval(id);\n});\n// no cleanup returned`}</Code>
      <Console lines={c.lines} height={120} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <RideApp fixed={false} />;
}

export function Solution() {
  return <RideApp fixed />;
}
