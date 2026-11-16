import { useEffect, useId, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Note, Resettable, Row, Stack, Stat, fakeRequest, useConsole } from '../../demo-kit';

export const scenario = 'An online banking app is open in two tabs on a shared family computer: "Settings" in tab A, "Accounts" in tab B.';
export const task = 'Click "Log out" in tab A, then look at tab B and try "Send €200" there.';
export const solutionNote = 'Same tabs: logout revokes the session on the server and is broadcast on a real BroadcastChannel.';

type Log = (text: string, tone?: 'bad' | 'good' | 'info' | 'warn') => void;
interface Server { valid: Set<string>; seq: number; loggedOut: Set<string> }

// The fake bank API. With the fix, logout deletes the session and every request checks it.
async function api(server: Server, fixed: boolean, path: string, token: string, signal: AbortSignal) {
  await fakeRequest(null, { delay: 350, signal });
  if (path === '/auth/logout') { if (fixed) server.valid.delete(token); server.loggedOut.add(token); return 204; }
  if (fixed && !server.valid.has(token)) return 401;
  return 200; // bug: a stateless token is accepted until it expires (in 30 days)
}

function Tab({ name, page, fixed, server, channel, log, onStatus }: {
  name: string; page: string; fixed: boolean; server: Server; channel: string; log: Log;
  onStatus: (tab: string, s: { signedIn: boolean; afterLogout?: boolean }) => void;
}) {
  const [token, setToken] = useState<string | null>('tok_1'); // in-memory, per tab
  const [balance, setBalance] = useState(4820);
  const [notice, setNotice] = useState('');
  const [asleep, setAsleep] = useState(false);
  const asleepRef = useRef(asleep);
  asleepRef.current = asleep;
  const life = useRef(new AbortController());
  const chan = useRef<BroadcastChannel | null>(null);

  useEffect(() => () => life.current.abort(), []);
  useEffect(() => onStatus(name, { signedIn: token !== null }), [token, name, onStatus]);

  // Real cross-tab channel: the only link between tab A and tab B.
  useEffect(() => {
    if (!fixed || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(channel);
    chan.current = ch;
    ch.onmessage = (e: MessageEvent<{ type: string }>) => {
      if (e.data.type !== 'logout') return;
      if (asleepRef.current) { log(`${name}: (asleep) missed the "logout" message`, 'warn'); return; }
      log(`${name}: received "logout" on BroadcastChannel → clearing data`, 'good');
      setToken(null); setNotice('You were signed out in another tab.');
    };
    return () => { ch.close(); chan.current = null; };
  }, [fixed, channel, name, log]);

  const logout = async () => {
    if (!token) return;
    const t = token;
    setToken(null); setNotice('');
    if (!fixed) { log(`${name}: cleared its own state, no server call, no message to other tabs`, 'warn'); return; }
    try { await api(server, fixed, '/auth/logout', t, life.current.signal); } catch { return; }
    log(`${name}: POST /auth/logout → 204, session revoked on the server`, 'info');
    chan.current?.postMessage({ type: 'logout' });
  };

  const send = async () => {
    if (!token) return;
    let status: number;
    try { status = await api(server, fixed, '/transfers', token, life.current.signal); } catch { return; }
    if (status === 401) {
      log(`${name}: POST /transfers → 401 (session revoked) → signed out`, 'good');
      setToken(null); setNotice('Your session ended. Please log in again.');
      return;
    }
    setBalance((b) => b - 200);
    const afterLogout = server.loggedOut.has(token);
    onStatus(name, { signedIn: true, afterLogout });
    log(`${name}: POST /transfers €200 → 200 OK${afterLogout ? ' (the user had logged out!)' : ''}`, afterLogout ? 'bad' : 'info');
  };

  return (
    <Browser url={`bank.example/${page}`} style={{ flex: '1 1 150px', minWidth: 0 }}>
      <Stack gap={8}>
        <Row><strong style={{ flex: '1 1 auto' }}>Tab {name}</strong>
          <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="checkbox" checked={asleep} onChange={(e) => setAsleep(e.target.checked)} /> asleep
          </label>
        </Row>
        {token ? (
          <>
            <Badge tone="info">Signed in as the Jansen family</Badge>
            <div style={{ font: '600 20px var(--font-mono)' }}>€{balance.toLocaleString('en-US')}</div>
            <Note>Last: Rent −€1,150 · Salary +€3,400</Note>
            <Row><Button onClick={send}>Send €200</Button><Button tone="ghost" onClick={logout}>Log out</Button></Row>
          </>
        ) : (
          <Stack gap={6}>
            <Badge tone="neutral">Signed out</Badge>
            {notice && <Note>{notice}</Note>}
          </Stack>
        )}
      </Stack>
    </Browser>
  );
}

function Bank({ fixed, reset }: { fixed: boolean; reset: () => void }) {
  const channel = `ffg-bank-auth-${useId()}`; // unique per demo instance
  const server = useRef<Server>({ valid: new Set(['tok_1']), seq: 1, loggedOut: new Set() }).current;
  const c = useConsole();
  const [signedIn, setSignedIn] = useState<Record<string, boolean>>({ A: true, B: true });
  const [abuse, setAbuse] = useState(0);
  const onStatus = useRef((tab: string, s: { signedIn: boolean; afterLogout?: boolean }) => {
    setSignedIn((prev) => (prev[tab] === s.signedIn ? prev : { ...prev, [tab]: s.signedIn }));
    if (s.afterLogout) setAbuse((n) => n + 1);
  }).current;

  const anyLoggedOut = !signedIn.A || !signedIn.B;
  const exposed = anyLoggedOut ? Object.values(signedIn).filter(Boolean).length : 0;

  return (
    <Stack gap={14}>
      <Row gap={10} align="stretch">
        <Tab name="A" page="settings" fixed={fixed} server={server} channel={channel} log={c.log} onStatus={onStatus} />
        <Tab name="B" page="accounts" fixed={fixed} server={server} channel={channel} log={c.log} onStatus={onStatus} />
      </Row>
      <Row gap={8}>
        <Stat label="tabs still showing balances after a logout" value={exposed} tone={exposed ? 'bad' : 'neutral'} />
        <Stat label="transfers after logout" value={abuse} tone={abuse ? 'bad' : 'neutral'} />
      </Row>
      <Row><Button tone="ghost" onClick={reset}>Reset both tabs</Button></Row>
      <Code>{fixed
        ? `await api.post('/auth/logout');            // server deletes the session
channel.postMessage({ type: 'logout' });    // other tabs clear their data
channel.onmessage = (e) => e.data.type === 'logout' && clearLocalSession();
// + any 401 from the API → clearLocalSession()`
        : `onClick={() => {
  setUser(null); setAccessToken(null);   // only THIS tab's memory
  navigate('/login');                     // no server call, no message
}}`}</Code>
      <Console lines={c.lines} height={130} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <Resettable>{(reset) => <Bank fixed={false} reset={reset} />}</Resettable>;
}

export function Solution() {
  return <Resettable>{(reset) => <Bank fixed reset={reset} />}</Resettable>;
}
