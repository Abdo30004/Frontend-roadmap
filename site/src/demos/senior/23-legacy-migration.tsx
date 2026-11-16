import { useEffect, useState } from 'react';
import { Badge, Browser, Button, Code, Meter, Note, Panel, Row, Stack, Stat, Steps, usePlayer, type Tone } from '../../demo-kit';

export const scenario = 'An insurance customer portal runs on AngularJS 1.x, which no longer gets security fixes. The team must move it to Next.js.';
export const task = 'Move the portal to the new stack. Watch how long nothing ships, what breaks for customers, and what happens to logins and bookmarks.';
export const solutionNote = 'Next.js becomes the front door, unmigrated paths fall back to AngularJS, one shared session, one route at a time.';

interface Route { path: string; name: string; hidden?: string }
const ROUTES: Route[] = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/claims/:id', name: 'Claim details' },
  { path: '/documents', name: 'Documents', hidden: 'joint policy holders download PDFs (undocumented)' },
  { path: '/policies/:id', name: 'Policy' },
  { path: '/payments', name: 'Payments' },
  { path: '/profile', name: 'Profile' },
];
const CUTOVER_BUGS = [
  'Joint policy holders cannot download their PDFs (undocumented legacy feature)',
  'Bookmarked deep links like /#/policies/P-88 return 404',
  'Everyone is logged out: new app ignores the PORTAL_SESSION cookie',
];

type Status = 'legacy' | 'new' | 'broken';

function Migration({ fixed }: { fixed: boolean }) {
  const [status, setStatus] = useState<Status[]>(ROUTES.map(() => 'legacy'));
  const [months, setMonths] = useState(0);
  const [shipped, setShipped] = useState(0);
  const [phase, setPhase] = useState<'building' | 'cutover' | 'rolledBack'>('building');
  const [current, setCurrent] = useState(-1);
  const [steps, setSteps] = useState<{ label: string; detail: string; tone?: Tone }[]>([]);
  const player = usePlayer(steps.length, 750);

  // Big-bang: the rewrite chases a moving target (legacy keeps getting urgent features).
  const legacyFeatures = 40 + Math.floor(months / 3) * 2;
  const rewritten = Math.min(legacyFeatures, Math.floor(months / 3) * 6);

  // FIXED: when the per-route pipeline finishes, the route is live for everyone.
  useEffect(() => {
    if (!fixed || !player.done || current < 0) return;
    setStatus((s) => s.map((v, i) => (i === current ? 'new' : v)));
    setShipped((n) => n + 1);
  }, [player.done]); // eslint-disable-line react-hooks/exhaustive-deps

  const migrateNext = () => {
    const i = status.indexOf('legacy');
    if (i < 0) return;
    const r = ROUTES[i];
    setCurrent(i);
    setMonths((m) => m + 1);
    setSteps([
      { label: `Build ${r.path} in Next.js`, detail: 'new code only; legacy untouched', tone: 'info' },
      r.hidden
        ? { label: 'Parity tests vs legacy', detail: `caught: ${r.hidden} → added before switching`, tone: 'warn' }
        : { label: 'Parity tests vs legacy', detail: 'same results on BASE_URL=legacy and new', tone: 'good' },
      { label: 'Shared session', detail: 'middleware verifies the same PORTAL_SESSION cookie', tone: 'good' },
      { label: 'Rollout 10% → 100%', detail: 'sticky flag per user; flag off = instant rollback', tone: 'good' },
    ]);
    setTimeout(player.play, 0);
  };

  const cutover = () => {
    setPhase('cutover');
    setStatus(ROUTES.map((r) => (r.hidden || r.path.includes(':') ? 'broken' : 'new')));
  };
  const reset = () => { setStatus(ROUTES.map(() => 'legacy')); setMonths(0); setShipped(0); setPhase('building'); setCurrent(-1); setSteps([]); player.reset(); };

  const migrated = status.filter((s) => s === 'new').length;
  const badge = (s: Status, i: number) => {
    if (fixed && player.playing && i === current) return <Badge tone="info">migrating…</Badge>;
    if (s === 'legacy') return <Badge>AngularJS</Badge>;
    if (s === 'new') return <Badge tone="good">Next.js</Badge>;
    return <Badge tone="bad">Next.js · broken</Badge>;
  };

  return (
    <Stack gap={14}>
      <Browser url="portal.insurer.example">
        <Stack gap={10}>
          <Row gap={6}>
            <Badge tone="info">portal.insurer.example</Badge>
            <span style={{ fontSize: 13 }}>→ {fixed ? 'Next.js (front door) → fallback: AngularJS' : phase === 'cutover' ? 'Next.js (DNS switched)' : 'AngularJS'}</span>
          </Row>
          <Stack gap={6}>
            {ROUTES.map((r, i) => (
              <Row key={r.path} gap={8} style={{ justifyContent: 'space-between', fontSize: 13, opacity: fixed && player.playing && i === current ? 0.7 : 1, transition: 'opacity 200ms ease' }}>
                <span><code>{r.path}</code> {r.name}</span>
                {badge(status[i], i)}
              </Row>
            ))}
          </Stack>
        </Stack>
      </Browser>

      {fixed ? (
        <Row>
          <Button tone="primary" onClick={migrateNext} disabled={player.playing || migrated === ROUTES.length}>Migrate next route</Button>
          <Button tone="ghost" onClick={reset}>Reset</Button>
        </Row>
      ) : (
        <Row>
          <Button tone="primary" onClick={() => setMonths((m) => m + 3)} disabled={phase !== 'building' || months >= 18}>Work 3 more months on the rewrite</Button>
          <Button tone="danger" onClick={cutover} disabled={phase !== 'building' || months < 12}>Launch weekend: switch DNS</Button>
          {phase === 'cutover' && <Button onClick={() => { setPhase('rolledBack'); setStatus(ROUTES.map(() => 'legacy')); }}>Roll back (2 days later)</Button>}
          <Button tone="ghost" onClick={reset}>Reset</Button>
        </Row>
      )}

      {fixed && steps.length > 0 && <Steps steps={steps} active={player.step} />}

      {!fixed && (
        <Stack gap={6}>
          <Row style={{ justifyContent: 'space-between', fontSize: 13 }}>
            <span>Rewrite completeness (separate repo)</span>
            <strong>{rewritten}/{legacyFeatures} features</strong>
          </Row>
          <Meter value={rewritten} max={legacyFeatures} tone="warn" />
          {months > 0 && <Note>Meanwhile legacy got {legacyFeatures - 40} urgent features the rewrite must also copy.</Note>}
        </Stack>
      )}

      <Row gap={8}>
        <Stat label="months elapsed" value={months} />
        <Stat label="releases shipped to users" value={fixed ? shipped : 0} tone={fixed ? (shipped ? 'good' : 'neutral') : months ? 'bad' : 'neutral'} />
        <Stat label="customer-facing bugs" value={fixed ? 0 : phase === 'building' ? '-' : CUTOVER_BUGS.length} tone={!fixed && phase !== 'building' ? 'bad' : 'good'} />
        <Stat label="users logged out" value={!fixed && phase === 'cutover' ? 'all' : 0} tone={!fixed && phase === 'cutover' ? 'bad' : 'good'} />
      </Row>

      {!fixed && phase !== 'building' && (
        <Panel title={phase === 'cutover' ? 'Launch weekend: support inbox' : 'After the rollback'} tone="bad">
          {phase === 'cutover'
            ? <Stack gap={4}>{CUTOVER_BUGS.map((b) => <div key={b} style={{ fontSize: 13 }}>✗ {b}</div>)}</Stack>
            : <Note>Back on AngularJS after {months} months of work. Nothing shipped, and the rewrite lost the business's trust.</Note>}
        </Panel>
      )}

      <Code>{fixed
        ? `// next.config.js: unmigrated paths go to the legacy app, same domain, same URLs\nrewrites: async () => ({ fallback: [{ source: '/:path*', destination: LEGACY_ORIGIN + '/:path*' }] })\n// middleware.ts: verifyLegacySession(req.cookies.get('PORTAL_SESSION'))`
        : `location / {\n  proxy_pass http://next-app:3000;   # was: http://angularjs-app:8080\n}\nif (!req.cookies.get('next_auth_token')) redirect('/login');`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <Migration fixed={false} />;
}

export function Solution() {
  return <Migration fixed />;
}
