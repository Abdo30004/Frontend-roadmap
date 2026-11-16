import { useEffect, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Note, Panel, Row, Stack, Stat } from '../../demo-kit';

export const scenario = 'A food-delivery checkout reports browser errors to an error tracker. On Saturday, paying with a meal voucher starts failing.';
export const task = 'Press "Pay with meal voucher" once, then "Simulate Saturday traffic". Can you tell what broke, where in the code, since which deploy, and who got alerted?';
export const solutionNote = 'Hidden source maps + release tag + user context, noise filtered, events grouped into issues, and a rate-based alert.';

type Kind = 'voucher' | 'resize' | 'ext' | 'abort';
interface Ev { id: number; kind: Kind; user: string }

const RAW: Record<Kind, string> = {
  voucher: 'TypeError: a.b is not a function\n    at main.3f9a.js:1:84213',
  resize: 'ResizeObserver loop limit exceeded',
  ext: "TypeError: Cannot read properties of null (reading 'shadowRoot')\n    at chrome-extension://hdokiejnpimakedhajhdlcegeplioahd/content.js:1:9902",
  abort: 'AbortError: The user aborted a request.',
};
const RELEASE = 'web@4f2a91c';
const ALERT_AT = 5; // checkout errors in 10 min, ~3x the 7-day baseline

function payWithVoucher(voucher: { code: string; validate?: () => boolean }) {
  // The API started returning plain JSON; the old class instance had a validate() method.
  return (voucher as unknown as { validate: () => boolean }).validate();
}

function Monitoring({ fixed }: { fixed: boolean }) {
  const [events, setEvents] = useState<Ev[]>([]);
  const [paidMsg, setPaidMsg] = useState<string | null>(null);
  const [ticks, setTicks] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>>();
  const nextId = useRef(0);
  useEffect(() => () => clearInterval(timer.current), []);

  const push = (kind: Kind, user: string) => setEvents((e) => [...e, { id: nextId.current++, kind, user }]);

  const pay = () => {
    try {
      payWithVoucher({ code: 'LUNCH-10' });
      setPaidMsg('Order placed');
    } catch (err) {
      // A real TypeError was thrown just now; the SDK captures it.
      setPaidMsg(`Something went wrong (${(err as Error).name})`);
      push('voucher', 'u_1029');
    }
  };

  const traffic = () => {
    clearInterval(timer.current);
    let n = 0;
    timer.current = setInterval(() => {
      n++;
      const kinds: Kind[] = ['resize', 'ext', 'abort', 'ext', 'voucher', 'resize'];
      push(kinds[n % kinds.length], `u_${1100 + ((n * 37) % 90)}`);
      push(n % 3 === 0 ? 'voucher' : 'ext', `u_${1200 + ((n * 53) % 70)}`);
      setTicks(n);
      if (n >= 18) clearInterval(timer.current);
    }, 120);
  };

  const reset = () => { clearInterval(timer.current); setEvents([]); setPaidMsg(null); setTicks(0); };

  const voucher = events.filter((e) => e.kind === 'voucher');
  const noise = events.length - voucher.length;
  const users = new Set(voucher.map((e) => e.user)).size;
  const alerted = fixed && voucher.length >= ALERT_AT;
  const simDone = ticks >= 18;

  return (
    <Stack gap={14}>
      <Browser url="foodie.example/checkout">
        <Stack gap={8}>
          <strong>Order #5521 · 2× Pad thai · €24.80</strong>
          <Row>
            <Button tone="primary" onClick={pay}>Pay with meal voucher</Button>
            <Button onClick={traffic} disabled={ticks > 0 && !simDone}>Simulate Saturday traffic</Button>
            <Button tone="ghost" onClick={reset}>Reset</Button>
          </Row>
          {paidMsg && <Badge tone="bad">{paidMsg}</Badge>}
        </Stack>
      </Browser>

      <Browser url="errors.tracker.example/acme/web/issues">
        <Stack gap={12}>
          <Row gap={8}>
            <Stat label={fixed ? 'issues' : 'issues (ungrouped)'} value={fixed ? (voucher.length ? 1 : 0) : events.length} tone={!fixed && events.length > 10 ? 'bad' : 'neutral'} />
            <Stat label={fixed ? 'noise dropped' : 'noise in the list'} value={noise} tone={fixed ? 'good' : noise ? 'warn' : 'neutral'} />
            <Stat label="on-call paged" value={alerted ? 'yes' : 'no'} tone={alerted ? 'good' : simDone ? 'bad' : 'neutral'} />
          </Row>

          {events.length === 0 && <Note>No events yet.</Note>}

          {fixed && voucher.length > 0 && (
            <Panel title="Issue WEB-3F2 · checkout" tone="bad">
              <Stack gap={8}>
                <Code>{`TypeError: voucher.validate is not a function
    at payWithVoucher (src/checkout/payments.ts:42:18)
    at onPayClick (src/checkout/PayButton.tsx:17:5)`}</Code>
                <Row gap={6}>
                  <Badge tone="info">release {RELEASE}</Badge>
                  <Badge tone="warn">first seen in this release</Badge>
                  <Badge>production</Badge>
                  <Badge>{voucher.length} events · {users} users</Badge>
                </Row>
                <Note>Breadcrumbs: GET /api/vouchers/LUNCH-10 200 → click "Pay with meal voucher" → error. User: id only, no email.</Note>
              </Stack>
            </Panel>
          )}

          {!fixed && events.length > 0 && (
            <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
              {[...events].reverse().slice(0, 40).map((e) => (
                <pre key={e.id} style={{ margin: 0, padding: '6px 10px', fontSize: 11.5, borderBottom: '1px solid var(--line)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: e.kind === 'voucher' ? 'var(--ink)' : 'var(--ink-3)' }}>
                  {RAW[e.kind]}
                  {'\n'}<span style={{ color: 'var(--ink-3)' }}>release: (none) · user: (none) · 1 event</span>
                </pre>
              ))}
            </div>
          )}

          {alerted && <Badge tone="good">Alert "checkout errors ≥ 3× baseline" → paged on-call (payments) within minutes</Badge>}
          {!fixed && simDone && <Badge tone="bad">No alert rules. Found out 6 h later from a ★☆☆☆☆ review: "can't pay with voucher!!"</Badge>}
        </Stack>
      </Browser>

      <Code>{fixed
        ? `build: { sourcemap: 'hidden' }  // uploaded to the tracker in CI, then deleted\nSentry.init({ release: GIT_SHA, environment: 'production',\n  allowUrls: [/foodie\\.example/], ignoreErrors: ['ResizeObserver loop', 'AbortError'] })`
        : `build: { sourcemap: true }      // .map files public on the CDN, never uploaded\nSentry.init({ dsn })              // no release, no environment, no filtering`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <Monitoring fixed={false} />;
}

export function Solution() {
  return <Monitoring fixed />;
}
