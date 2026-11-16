import { useEffect, useState } from 'react';
import { Badge, Browser, Button, Code, Note, Panel, Row, Stack, Stat } from '../../demo-kit';

export const scenario = 'An online banking app (React SPA) is opened on a 4G phone. Users only need the login form first, then their accounts.';
export const task = 'Click "Open bank.example on 4G", log in, then hover and open Investments and Statements. Watch the waterfall, KB and time to interactive.';
export const solutionNote = 'Same app, split per route with React.lazy: login ships alone, other pages load on demand and prefetch on hover.';

// Simulated network: a browser can't really throttle itself, so this is a model with real rules.
const KBPS = 400;      // ~4G: 400 KB per second
const LATENCY = 150;   // ms per request
const PARSE = 0.4;     // ms of parse/execute per KB of JS
const SPEED = 4;       // the animation runs 4× faster than "phone time"

interface Req { name: string; kb: number; start: number; end: number; why: string }
type RouteId = 'login' | 'accounts' | 'investments' | 'statements' | 'admin';
const ROUTES: { id: Exclude<RouteId, 'login'>; label: string; kb: number; note: string }[] = [
  { id: 'accounts', label: 'Accounts', kb: 120, note: 'balances, transactions' },
  { id: 'investments', label: 'Investments', kb: 380, note: 'chart library' },
  { id: 'statements', label: 'Statements', kb: 900, note: 'pdf.js viewer' },
  { id: 'admin', label: 'Admin', kb: 600, note: 'used by 1% of users' },
];
const INITIAL = {
  bug: [{ name: 'main.4f2a.js', kb: 2400 }],
  fix: [{ name: 'react-vendor.91c3.js', kb: 140 }, { name: 'main.7d1e.js', kb: 40 }, { name: 'login.chunk.js', kb: 60 }],
};
const chunkName = (id: string) => `${id}.chunk.js`;

function BankApp({ fixed }: { fixed: boolean }) {
  const [clock, setClock] = useState(0);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [route, setRoute] = useState<RouteId | null>(null);
  const [navAt, setNavAt] = useState(0);

  const initial = fixed ? INITIAL.fix : INITIAL.bug;
  const opened = route !== null;
  const initialKb = initial.reduce((s, f) => s + f.kb, 0);
  const tti = opened ? Math.max(...reqs.filter((r) => r.why === 'initial').map((r) => r.end), 0) + initialKb * PARSE : 0;
  const interactive = opened && clock >= tti;
  const pending = reqs.some((r) => r.end > clock) || (opened && !interactive);

  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => setClock((c) => c + 50 * SPEED), 50);
    return () => clearInterval(id);
  }, [pending]);

  const request = (name: string, kb: number, why: string) =>
    setReqs((rs) => (rs.some((r) => r.name === name) ? rs : [...rs, { name, kb, why, start: clock, end: clock + LATENCY + (kb / KBPS) * 1000 }]));

  // Fixed version: when the login screen is ready, warm up the most likely next page (requestIdleCallback).
  useEffect(() => {
    if (fixed && interactive) request(chunkName('accounts'), 120, 'idle prefetch');
  }, [fixed, interactive]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = () => {
    setClock(0);
    setRoute('login');
    setNavAt(0);
    setReqs(initial.map((f) => ({ ...f, why: 'initial', start: 0, end: LATENCY + (f.kb / KBPS) * 1000 })));
  };
  const go = (id: RouteId) => {
    setRoute(id);
    setNavAt(clock);
    if (fixed && id !== 'login') request(chunkName(id), ROUTES.find((r) => r.id === id)!.kb, 'navigation');
  };
  const prefetch = (id: string, kb: number) => { if (fixed && interactive) request(chunkName(id), kb, 'hover prefetch'); };

  const chunk = route && route !== 'login' ? reqs.find((r) => r.name === chunkName(route)) : undefined;
  const pageReady = !fixed || route === 'login' || (chunk !== undefined && chunk.end <= clock);
  const wait = route && route !== 'login' && interactive && pageReady ? (chunk ? Math.max(0, chunk.end - navAt) : 0) : null;
  const kb = reqs.filter((r) => r.start <= clock).reduce((s, r) => s + r.kb, 0);
  const span = Math.max(8000, ...reqs.map((r) => r.end));
  const page = ROUTES.find((r) => r.id === route);

  return (
    <Stack gap={12}>
      <Row gap={8}>
        <Button tone="primary" onClick={open}>{opened ? 'Reload (cold cache)' : 'Open bank.example on 4G'}</Button>
      </Row>
      <Browser url={`bank.example/${route ?? ''}`}>
        {!opened ? <Note>Not opened yet.</Note> : !interactive ? (
          <div style={{ minHeight: 90, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontSize: 13 }}>(blank page: downloading JavaScript…)</div>
        ) : route === 'login' ? (
          <Stack gap={8}>
            <strong>Sign in to Bank</strong>
            <Row><Button tone="primary" onClick={() => go('accounts')}>Log in as Sam</Button></Row>
          </Stack>
        ) : (
          <Stack gap={10}>
            <Row gap={4}>
              {ROUTES.map((r) => (
                <Button key={r.id} tone={route === r.id ? 'primary' : 'ghost'} onClick={() => go(r.id)}
                  onMouseEnter={() => prefetch(r.id, r.kb)} onFocus={() => prefetch(r.id, r.kb)} style={{ padding: '4px 10px' }}>{r.label}</Button>
              ))}
            </Row>
            {pageReady && page ? (
              <Panel title={page.label}><Note>{page.note} · ready</Note></Panel>
            ) : <Panel title="Loading page…"><Note>Skeleton while {chunkName(route ?? '')} downloads</Note></Panel>}
          </Stack>
        )}
      </Browser>
      <Row gap={8}>
        <Stat label="JS downloaded" value={`${kb.toLocaleString()} KB`} tone={kb > 1000 ? 'bad' : 'neutral'} />
        <Stat label="time to interactive" value={opened ? (interactive ? `${(tti / 1000).toFixed(1)}s` : '…') : '–'} tone={interactive ? (tti > 3000 ? 'bad' : 'good') : 'neutral'} />
        <Stat label="last page switch wait" value={wait === null ? '–' : `${Math.round(wait)}ms`} tone={wait !== null && wait > 300 ? 'warn' : 'neutral'} />
      </Row>
      {reqs.length > 0 && (
        <Panel title="Network waterfall">
          <Stack gap={6}>
            {reqs.map((r) => {
              const done = Math.max(0, Math.min(clock, r.end) - r.start);
              return (
                <Stack key={r.name} gap={2}>
                  <Row gap={6} style={{ fontSize: 12 }}>
                    <code>{r.name}</code><span style={{ color: 'var(--ink-3)' }}>{r.kb} KB</span>
                    <Badge tone={r.why === 'initial' ? 'neutral' : r.why === 'navigation' ? 'warn' : 'info'}>{r.why}</Badge>
                  </Row>
                  <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'var(--paper-2)', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, transformOrigin: 'left', background: r.end <= clock ? 'var(--good)' : 'var(--info)',
                      transform: `translateX(${(r.start / span) * 100}%) scaleX(${done / span})`, transition: 'transform 150ms linear, background-color 200ms ease' }} />
                  </div>
                </Stack>
              );
            })}
          </Stack>
        </Panel>
      )}
      <Code>{fixed
        ? `import Login from './pages/Login'; // entry route stays in main\nconst loadInvestments = () => import('./pages/Investments');\nconst Investments = lazy(loadInvestments);\n<Link onMouseEnter={loadInvestments} to="/investments">…`
        : `import Accounts from './pages/Accounts';\nimport Investments from './pages/Investments'; // + charts\nimport Statements from './pages/Statements';   // + pdf.js\nimport AdminPanel from './pages/AdminPanel';   // 1% of users`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <BankApp fixed={false} />;
}

export function Solution() {
  return <BankApp fixed />;
}
