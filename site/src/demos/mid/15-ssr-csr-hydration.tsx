import { useEffect, useState } from 'react';
import {
  Badge,
  Browser,
  Button,
  Code,
  Console,
  Note,
  Panel,
  Row,
  Stack,
  Stat,
  Steps,
  useConsole,
  usePlayer,
  type Tone,
} from '../../demo-kit';

export const scenario =
  'A travel site renders its flight search results. Visitors come from many time zones and some have seen the promo before.';
export const task = 'Play the CSR load, then switch to SSR and play again. Watch the page, the departure time and the console.';
export const solutionNote =
  'Same SSR page: the time is formatted in the airport time zone, and localStorage is read in an effect after hydration.';

type Mode = 'csr' | 'ssr';
const FLIGHT = { route: 'Paris CDG → Lisbon LIS', iso: '2026-11-20T07:00:00Z', originTz: 'Europe/Paris', price: 89 };
const ZONES = ['Europe/Paris', 'America/New_York', 'Asia/Tokyo', 'Europe/London'];

const fmt = (tz: string) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(FLIGHT.iso));

interface Markup {
  departs: string;
  promo: boolean;
}

function FlightPage({ fixed }: { fixed: boolean }) {
  const [mode, setMode] = useState<Mode>('csr');
  const [visitorTz, setVisitorTz] = useState('America/New_York');
  const [seenPromo, setSeenPromo] = useState(true);
  const [errors, setErrors] = useState(0);
  const c = useConsole();
  const player = usePlayer(4, 1000);
  const { step } = player;

  // What the server (UTC, no window) renders, and what the browser renders on its FIRST render.
  const server: Markup = fixed ? { departs: fmt(FLIGHT.originTz), promo: true } : { departs: fmt('UTC'), promo: true };
  const clientFirst: Markup = fixed ? { departs: fmt(FLIGHT.originTz), promo: true } : { departs: fmt(visitorTz), promo: !seenPromo };
  const afterEffects: Markup = { ...clientFirst, promo: !seenPromo };
  const mismatch = server.departs !== clientFirst.departs || server.promo !== clientFirst.promo;

  const steps: { label: string; detail: string; tone?: Tone }[] =
    mode === 'csr'
      ? [
          { label: 'GET /search', detail: '200 · <div id="root"></div> (empty)', tone: 'warn' },
          { label: 'Download app.js', detail: '1.2 MB on 4G · still blank' },
          { label: 'React renders', detail: 'fetches flights · spinner' },
          { label: 'Page visible', detail: 'first content at ≈ 2.4 s', tone: 'good' },
        ]
      : [
          { label: 'GET /search', detail: '200 · full HTML, visible at ≈ 0.3 s', tone: 'good' },
          { label: 'Download app.js', detail: 'page visible but not interactive yet' },
          mismatch
            ? { label: 'Hydrate', detail: 'server HTML ≠ client render → re-render', tone: 'bad' }
            : { label: 'Hydrate', detail: 'markup matches → handlers attached', tone: 'good' },
          { label: 'Effects run', detail: fixed ? 'reads localStorage, updates promo' : 'interactive', tone: 'info' },
        ];

  useEffect(() => {
    if (step < 0) return;
    if (mode === 'ssr' && step === 0)
      c.log(`server (TZ=UTC) rendered "Departs at ${server.departs}"${server.promo ? ' + promo banner' : ''}`, 'info');
    if (mode === 'ssr' && step === 2) {
      if (mismatch) {
        if (server.departs !== clientFirst.departs)
          c.log(
            `Error: Hydration failed because the server rendered text didn't match the client.\n  server: "${server.departs}"  client: "${clientFirst.departs}"`,
            'bad',
          );
        if (server.promo !== clientFirst.promo)
          c.log('Error: Hydration failed: <PromoBanner> exists in server HTML but not in client render.', 'bad');
        c.log('React throws away the server HTML and client-renders the tree (content flashes).', 'warn');
        setErrors((n) => n + 1);
      } else c.log('hydrated: server HTML reused, no DOM changes', 'good');
    }
    if (mode === 'ssr' && step === 3 && fixed && seenPromo)
      c.log('useEffect: localStorage.seenPromo = "1" → hide promo (normal update, no error)', 'info');
    if (mode === 'csr' && step === 3) c.log(`client rendered "Departs at ${afterEffects.departs}" (no server HTML to compare)`, 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // What the visitor sees at each step
  let view: Markup | 'blank' | 'spinner' = 'blank';
  if (step >= 0) {
    if (mode === 'csr') view = step < 2 ? 'blank' : step === 2 ? 'spinner' : afterEffects;
    else view = step < 2 ? server : step === 2 ? clientFirst : afterEffects;
  }
  const flashing = mode === 'ssr' && step === 2 && mismatch;

  const play = () => {
    c.clear();
    player.play();
  };
  const select = {
    font: '14px var(--font-body)',
    padding: '6px 8px',
    borderRadius: 8,
    border: '1px solid var(--line-2)',
    background: 'var(--surface)',
    color: 'var(--ink)',
    maxWidth: '100%',
  };

  return (
    <Stack gap={14}>
      <Row gap={8}>
        <Button
          tone={mode === 'csr' ? 'primary' : 'default'}
          onClick={() => {
            setMode('csr');
            player.reset();
          }}
        >
          CSR
        </Button>
        <Button
          tone={mode === 'ssr' ? 'primary' : 'default'}
          onClick={() => {
            setMode('ssr');
            player.reset();
          }}
        >
          SSR
        </Button>
        <select
          aria-label="Visitor time zone"
          value={visitorTz}
          onChange={(e) => {
            setVisitorTz(e.target.value);
            player.reset();
          }}
          style={select}
        >
          {ZONES.map((z) => (
            <option key={z} value={z}>
              visitor in {z}
            </option>
          ))}
        </select>
        <label style={{ fontSize: 13, color: 'var(--ink-2)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={seenPromo}
            onChange={(e) => {
              setSeenPromo(e.target.checked);
              player.reset();
            }}
          />{' '}
          returning visitor
        </label>
      </Row>
      <Row>
        <Button tone="primary" onClick={play} disabled={player.playing}>
          ▶ Load the page ({mode.toUpperCase()})
        </Button>
      </Row>
      {step >= 0 && <Steps steps={steps} active={step} />}
      <Browser url="travelnow.example/search?from=CDG&to=LIS">
        {view === 'blank' ? (
          <div style={{ minHeight: 120, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
            {step < 0 ? 'Not loaded yet.' : '(blank white page)'}
          </div>
        ) : view === 'spinner' ? (
          <div style={{ minHeight: 120, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
            ⟳ Loading flights…
          </div>
        ) : (
          <Stack gap={10}>
            {view.promo && (
              <Panel tone="info">
                <strong>−20% on your first booking!</strong> <Note>Use code HELLO20</Note>
              </Panel>
            )}
            <article style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
              <strong>{FLIGHT.route}</strong>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 14,
                  transition: 'background-color 200ms ease, color 200ms ease',
                  background: flashing ? 'var(--bad-soft)' : 'transparent',
                  color: flashing ? 'var(--bad)' : 'var(--ink)',
                  borderRadius: 6,
                  padding: '2px 4px',
                  display: 'inline-block',
                }}
              >
                Departs at <b>{view.departs}</b>
                {fixed && <span style={{ color: 'var(--ink-3)' }}> (Paris time)</span>}
              </div>
              <Row style={{ marginTop: 8 }}>
                <Badge tone="good">€{FLIGHT.price}</Badge>
                <Button disabled={mode === 'ssr' && step < 2}>Select</Button>
              </Row>
            </article>
          </Stack>
        )}
      </Browser>
      <Row gap={8}>
        <Stat
          label="first content"
          value={step < 0 ? '–' : mode === 'csr' ? '2.4 s' : '0.3 s'}
          tone={step < 0 ? 'neutral' : mode === 'csr' ? 'warn' : 'good'}
        />
        <Stat label="hydration errors" value={errors} tone={errors ? 'bad' : 'neutral'} />
      </Row>
      <Code>
        {fixed
          ? `const departs = new Intl.DateTimeFormat('en-GB', { timeZone: flight.originTz, … }).format(d);
const [seenPromo, setSeenPromo] = useState(false);       // same on server and client
useEffect(() => setSeenPromo(localStorage.getItem('seenPromo') === '1'), []);`
          : `const departs = new Date(flight.iso).toLocaleTimeString(); // server TZ ≠ browser TZ
const seen = typeof window !== 'undefined' && localStorage.getItem('seenPromo');
{!seen && <PromoBanner />}                                 // server: shown, client: hidden`}
      </Code>
      <Console lines={c.lines} height={130} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <FlightPage fixed={false} />;
}

export function Solution() {
  return <FlightPage fixed />;
}
