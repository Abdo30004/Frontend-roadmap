import { useState } from 'react';
import { Badge, Browser, Button, Code, Note, Panel, Row, Stack, Stat, usePlayer } from '../../demo-kit';

export const scenario =
  'A food-delivery web app home screen shows the user greeting, nearby restaurants, promotions and the active order, on a mid-range phone over 4G.';
export const task = 'Press "Open the app" and watch the network waterfall, the payload sizes and what the response contains.';
export const solutionNote =
  'Same screen: one call to /api/home; the BFF fans out in parallel on the server and returns only what the screen needs.';

interface Req {
  label: string;
  start: number;
  ms: number;
  kb: number;
  via?: 'server';
}

// Phone requests over 4G (~400 ms round trip). Each one waits for the previous (it needs its result).
const DIRECT: Req[] = [
  { label: 'GET users.api/me', start: 0, ms: 450, kb: 4 },
  { label: 'GET users.api/:id/addresses', start: 450, ms: 420, kb: 3 },
  { label: 'GET catalog.api/restaurants?lat&lng', start: 870, ms: 1900, kb: 900 },
  { label: 'GET partner-promos/v2/offers', start: 2770, ms: 480, kb: 12 },
  { label: 'GET orders.api/active?user', start: 3250, ms: 430, kb: 2 },
];
// One phone request; the fan-out happens server-to-server (~40 ms each), partly in parallel.
const BFF: Req[] = [
  { label: 'GET /api/home (phone → BFF)', start: 0, ms: 610, kb: 6 },
  { label: 'users/me · addresses · orders', start: 200, ms: 45, kb: 0, via: 'server' },
  { label: 'restaurants?fields=… · promos', start: 245, ms: 120, kb: 0, via: 'server' },
];
const SCALE = 3700;

const LEAKY_JSON = `// GET catalog.api/restaurants → 900 KB
[{ "id": "r_19", "name": "Pho Saigon", "rating": 4.7, "eta": 25,
   "menu": [ …312 items with photos… ],
   "commissionRate": 0.27, "supplierCost": 3.10,
   "internalNotes": "late payments, renegotiate Q1" }, …]
// GET users.api/me → { …, "fraudScore": 0.12, "passwordUpdatedAt": … }
// request header: X-Api-Key: pk_live_7f3a9c… (from the JS bundle)`;

const BFF_JSON = `// GET /api/home → 6 KB
{ "greetingName": "Sam",
  "activeOrder": { "id": "o_88", "status": "On the way", "eta": 12 },
  "restaurants": [{ "id": "r_19", "name": "Pho Saigon", "rating": 4.7, "eta": 25 }, …],
  "promos": [{ "id": "p1", "title": "Free delivery over $20" }] }`;

function HomeScreen({ fixed }: { fixed: boolean }) {
  const reqs = fixed ? BFF : DIRECT;
  const player = usePlayer(reqs.length + 1, 650);
  const [opened, setOpened] = useState(false);
  const visible = player.step; // number of bars revealed (-1 = none)
  const loaded = opened && player.done;
  const total = Math.max(...reqs.map((r) => r.start + r.ms));
  const kb = reqs.reduce((s, r) => s + r.kb, 0);
  const phoneRequests = reqs.filter((r) => r.via !== 'server').length;

  return (
    <Stack gap={14}>
      <Row>
        <Button
          tone="primary"
          onClick={() => {
            setOpened(true);
            player.play();
          }}
          disabled={player.playing}
        >
          Open the app
        </Button>
        <Button
          tone="ghost"
          onClick={() => {
            setOpened(false);
            player.reset();
          }}
        >
          Reset
        </Button>
      </Row>
      <Row gap={12} align="stretch">
        <Browser url="eats.example (mobile · 4G)" style={{ flex: '1 1 200px', maxWidth: 300 }}>
          {!opened ? (
            <Note>App not opened yet.</Note>
          ) : !loaded ? (
            <Stack gap={8}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ height: 16, borderRadius: 6, background: 'var(--paper-2)' }} />
              ))}
              <Note>Loading…</Note>
            </Stack>
          ) : (
            <Stack gap={8}>
              <strong>Hi Sam 👋</strong>
              <Badge tone="info">Order o_88 · On the way · 12 min</Badge>
              <Note>Free delivery over $20</Note>
              {['Pho Saigon · ★4.7 · 25 min', 'Pizza Nonna · ★4.5 · 30 min', 'Green Bowl · ★4.8 · 20 min'].map((r) => (
                <div key={r} style={{ fontSize: 13, padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 8 }}>
                  {r}
                </div>
              ))}
            </Stack>
          )}
        </Browser>
        <Panel title="Network (waterfall)" style={{ flex: '1 1 220px', minWidth: 0 }}>
          <Stack gap={6}>
            {reqs.map((r, i) => (
              <div key={r.label} style={{ opacity: i <= visible ? 1 : 0.15, transition: 'opacity 220ms ease' }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontFamily: 'var(--font-mono)',
                    color: r.via ? 'var(--ink-3)' : 'var(--ink-2)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.via ? '  ↳ ' : ''}
                  {r.label} {r.kb ? `· ${r.kb} KB` : '· internal'}
                </div>
                <div style={{ position: 'relative', height: 8, background: 'var(--paper-2)', borderRadius: 4 }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${(r.start / SCALE) * 100}%`,
                      width: `${Math.max(1, (r.ms / SCALE) * 100)}%`,
                      borderRadius: 4,
                      background: r.kb > 100 ? 'var(--bad)' : r.via ? 'var(--ink-3)' : 'var(--info)',
                    }}
                  />
                </div>
              </div>
            ))}
            <Note>0 ms ··· {SCALE} ms</Note>
          </Stack>
        </Panel>
      </Row>
      {loaded && (
        <Row gap={8}>
          <Stat label="requests from the phone" value={phoneRequests} tone={phoneRequests > 1 ? 'bad' : 'good'} />
          <Stat label="time to home screen" value={`${(total / 1000).toFixed(1)} s`} tone={total > 1500 ? 'bad' : 'good'} />
          <Stat label="downloaded" value={`${kb} KB`} tone={kb > 100 ? 'bad' : 'good'} />
          <Stat label="leaked internals / secrets" value={fixed ? 0 : 6} tone={fixed ? 'good' : 'bad'} />
        </Row>
      )}
      {loaded && <Code>{fixed ? BFF_JSON : LEAKY_JSON}</Code>}
    </Stack>
  );
}

export function Problem() {
  return <HomeScreen fixed={false} />;
}

export function Solution() {
  return <HomeScreen fixed />;
}
