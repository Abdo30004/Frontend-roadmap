import { useState } from 'react';
import { Badge, Browser, Button, Code, Console, Note, Panel, Row, Stack, Stat, useConsole } from '../../demo-kit';

export const scenario = 'A B2B invoicing app. Lena logs in with the "viewer" role; the page also loads a third-party chat widget.';
export const task = 'Log in, then run the chat widget script. Next, use "Replay request" (as from DevTools) to delete an invoice as a viewer.';
export const solutionNote = 'Same app: the session is an httpOnly cookie, and the API checks the role on every request (403).';

interface Invoice { id: number; client: string; amount: number }
const INITIAL: Invoice[] = [
  { id: 42, client: 'Globex GmbH', amount: 12_400 },
  { id: 43, client: 'Initech Ltd', amount: 3_150 },
  { id: 44, client: 'Hooli Inc.', amount: 8_900 },
];
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJsZW5hIiwicm9sZSI6InZpZXdlciIsImV4cCI6OTk5OTk5OTk5OX0.x9F…';
const USER: { name: string; role: 'admin' | 'viewer' } = { name: 'Lena', role: 'viewer' };

function InvoicingApp({ fixed }: { fixed: boolean }) {
  // The simulated browser storage of this page
  const [localStore, setLocalStore] = useState<Record<string, string>>({});
  const [cookies, setCookies] = useState<{ name: string; value: string; httpOnly: boolean }[]>([]);
  const [invoices, setInvoices] = useState(INITIAL);
  const [stolen, setStolen] = useState<string | null>(null);
  const [deletedByViewer, setDeletedByViewer] = useState(0);
  const c = useConsole();
  const loggedIn = fixed ? cookies.length > 0 : 'token' in localStore;

  const login = () => {
    if (fixed) {
      setCookies([{ name: 'sid', value: 's_8f2k1q', httpOnly: true }]);
      c.log('POST /login → 200 · Set-Cookie: sid=s_8f2k1q; HttpOnly; Secure; SameSite=Lax', 'info');
    } else {
      setLocalStore({ token: TOKEN });
      c.log('POST /login → 200 · { token } → localStorage.setItem("token", token)', 'info');
    }
  };

  // What any script on the page (e.g. the chat widget, or an XSS payload) can read
  const runWidget = () => {
    const readableCookies = cookies.filter((k) => !k.httpOnly).map((k) => `${k.name}=${k.value}`).join('; ');
    const token = localStore.token;
    c.log(`widget.js: localStorage.getItem("token") → ${token ? `"${token.slice(0, 24)}…"` : 'null'}`, token ? 'bad' : 'good');
    c.log(`widget.js: document.cookie → "${readableCookies}"`, readableCookies ? 'bad' : 'good');
    setStolen(token ?? (readableCookies || null));
  };

  // Fake API: DELETE /invoices/:id
  const apiDelete = (id: number, viaUi: boolean) => {
    if (!loggedIn) { c.log(`DELETE /invoices/${id} → 401 Unauthorized`, 'warn'); return; }
    if (fixed && USER.role !== 'admin') {
      c.log(`DELETE /invoices/${id} → 403 Forbidden (role "viewer" lacks invoice:delete)`, 'good');
      return;
    }
    setInvoices((list) => list.filter((i) => i.id !== id));
    if (!viaUi) setDeletedByViewer((n) => n + 1);
    c.log(`DELETE /invoices/${id} → 204 No Content (only checked "is logged in")`, 'bad');
  };

  const target = invoices[0];
  return (
    <Stack gap={14}>
      <Browser url="app.billwise.example/invoices">
        {!loggedIn ? (
          <Row><Note>Signed out.</Note><Button tone="primary" onClick={login}>Log in as Lena (viewer)</Button></Row>
        ) : (
          <Stack gap={8}>
            <Row><strong style={{ flex: '1 1 auto' }}>Invoices</strong><Badge tone="info">{USER.name} · {USER.role}</Badge></Row>
            {invoices.map((inv) => (
              <Row key={inv.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>#{inv.id}</span>
                <span style={{ flex: '1 1 auto' }}>{inv.client}</span>
                <strong>€{inv.amount.toLocaleString('en-US')}</strong>
                {/* the Delete button is only rendered for admins */}
                {USER.role === 'admin' && <Button tone="danger" onClick={() => apiDelete(inv.id, true)}>Delete</Button>}
              </Row>
            ))}
            {invoices.length === 0 && <Note>No invoices left.</Note>}
            <Note>💬 Chat widget loaded from chat-widget.example</Note>
          </Stack>
        )}
      </Browser>
      <Row gap={10} align="stretch">
        <Panel title="DevTools · Application" style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)', overflowWrap: 'anywhere' }}>
            <div>localStorage: {Object.keys(localStore).length ? `token = ${TOKEN.slice(0, 18)}…` : '(empty)'}</div>
            <div>cookies: {cookies.length ? cookies.map((k) => `${k.name} ✓HttpOnly`).join(', ') : '(none)'}</div>
          </div>
        </Panel>
        <Panel title="Attacker" tone={stolen ? 'bad' : undefined} style={{ flex: '1 1 200px', minWidth: 0 }}>
          <Stack gap={6}>
            <Row>
              <Button onClick={runWidget} disabled={!loggedIn}>Run widget script</Button>
              <Button onClick={() => target && apiDelete(target.id, false)} disabled={!loggedIn || !target}>Replay DELETE /invoices/{target?.id ?? '…'}</Button>
            </Row>
            <div style={{ fontSize: 12.5, overflowWrap: 'anywhere' }}>{stolen ? `Got a token valid for 30 days: ${stolen.slice(0, 22)}…` : 'Nothing stolen.'}</div>
          </Stack>
        </Panel>
      </Row>
      <Row gap={8}>
        <Stat label="token readable by any script" value={!loggedIn ? '–' : fixed ? 'no' : 'yes'} tone={!loggedIn ? 'neutral' : fixed ? 'good' : 'bad'} />
        <Stat label="invoices deleted by a viewer" value={deletedByViewer} tone={deletedByViewer ? 'bad' : 'neutral'} />
      </Row>
      <Code>{fixed
        ? `res.cookie('sid', id, { httpOnly: true, secure: true, sameSite: 'lax' });
app.delete('/invoices/:id', requireSession, (req, res) => {
  if (!req.user.permissions.includes('invoice:delete')) return res.sendStatus(403); …`
        : `localStorage.setItem('token', token);          // any script can read it
{user.role === 'admin' && <DeleteButton />}       // hidden in the UI only…
app.delete('/invoices/:id', requireLogin, del);  // …the API never checks the role`}</Code>
      <Console lines={c.lines} height={130} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <InvoicingApp fixed={false} />;
}

export function Solution() {
  return <InvoicingApp fixed />;
}
