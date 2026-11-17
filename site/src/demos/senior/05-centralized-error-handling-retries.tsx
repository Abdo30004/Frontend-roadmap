import { useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Resettable, Row, Stack, Stat, sleep, useConsole } from '../../demo-kit';

export const scenario =
  'A banking dashboard loads five widgets in parallel; access tokens expire after 15 minutes and the refresh token rotates on every use.';
export const task =
  'Press "Transfer €50" once. Then press "Wait 15 min" and "Refresh dashboard". Watch transfers, refresh calls and toasts.';
export const solutionNote =
  'Same client: one shared refresh promise, retries only for idempotent/keyed requests with backoff + jitter, deduped toasts.';

const WIDGETS = ['accounts', 'cards', 'transactions', 'notifications', 'limits'] as const;

class HttpError extends Error {
  constructor(
    public status: number,
    msg: string,
  ) {
    super(msg);
  }
}
interface Req {
  method: 'GET' | 'POST';
  path: string;
  key?: string;
}

/* ---------- fake bank API: rotating refresh tokens with reuse detection ---------- */
function createServer() {
  const s = { access: 'at-1', refresh: 'rt-1', n: 1, revoked: false, transfers: 0, seenKeys: new Set<string>(), flaky: 0 };
  const latency = () => sleep(150 + Math.random() * 250);
  return {
    state: s,
    async handle(req: Req, token: string): Promise<string> {
      await latency();
      if (s.revoked || token !== s.access) throw new HttpError(401, 'token expired');
      if (req.method === 'POST') {
        if (!(req.key && s.seenKeys.has(req.key))) s.transfers++; // money moves...
        if (req.key) s.seenKeys.add(req.key);
        if (s.flaky-- > 0) throw new HttpError(503, 'gateway timeout'); // ...but the response is lost
        return 'transfer ok';
      }
      if (req.path === '/transactions' && s.flaky-- > 0) throw new HttpError(503, 'upstream busy');
      return `${req.path.slice(1)} loaded`;
    },
    async refresh(presented: string) {
      await latency();
      if (s.revoked || presented !== s.refresh) {
        s.revoked = true;
        throw new HttpError(401, 'refresh token reuse → session revoked');
      }
      s.n++;
      s.access = `at-${s.n}`;
      s.refresh = `rt-${s.n}`;
      return { access: s.access, refresh: s.refresh };
    },
  };
}

function Dashboard({ fixed, reset }: { fixed: boolean; reset: () => void }) {
  const [server] = useState(createServer);
  const tokens = useRef({ access: 'at-1', refresh: 'rt-1' });
  const refreshPromise = useRef<Promise<void> | null>(null);
  const lastToast = useRef(new Map<string, number>());
  const c = useConsole();
  const [widgets, setWidgets] = useState<Record<string, 'idle' | 'loading' | 'ok' | 'error'>>({});
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [refreshCalls, setRefreshCalls] = useState(0);
  const [, force] = useState(0);

  const toast = (text: string) => {
    const now = Date.now();
    if (fixed && now - (lastToast.current.get(text) ?? 0) < 3000) return; // deduped within 3s
    lastToast.current.set(text, now);
    setToasts((t) => [...t, { id: now + Math.random(), text }].slice(-8));
  };

  const doRefresh = async () => {
    setRefreshCalls((n) => n + 1);
    c.log(`POST /auth/refresh (${tokens.current.refresh})`, 'warn');
    tokens.current = await server.refresh(tokens.current.refresh);
  };
  // FIX: every concurrent 401 awaits the same promise
  const refreshSingleFlight = () => {
    refreshPromise.current ??= doRefresh().finally(() => {
      refreshPromise.current = null;
    });
    return refreshPromise.current;
  };

  async function call(req: Req, attempt = 0, authRetried = false): Promise<string> {
    const sentWith = tokens.current.access;
    try {
      return await server.handle(req, sentWith);
    } catch (e) {
      const err = e as HttpError;
      if (err.status === 401 && !authRetried) {
        c.log(`${req.method} ${req.path} → 401`, 'bad');
        // FIX: if another request already refreshed, just replay with the new token
        if (fixed && tokens.current.access !== sentWith) return call(req, attempt, true);
        await (fixed ? refreshSingleFlight() : doRefresh());
        return call(req, attempt, true);
      }
      if (err.status === 503 && attempt < 3) {
        const safe = req.method === 'GET' || !!req.key;
        if (!fixed) {
          c.log(`${req.method} ${req.path} → 503, retrying immediately`, 'bad');
          return call(req, attempt + 1, authRetried);
        }
        if (safe) {
          const delay = Math.round(Math.random() * Math.min(2000, 300 * 2 ** (attempt + 1))); // full jitter
          c.log(`${req.method} ${req.path} → 503, retry #${attempt + 1} in ${delay}ms${req.key ? ' (Idempotency-Key)' : ''}`, 'warn');
          await sleep(delay);
          return call(req, attempt + 1, authRetried);
        }
      }
      throw err;
    }
  }

  const refreshDashboard = async () => {
    c.log('— refresh dashboard: 5 parallel GETs —', 'info');
    setWidgets(Object.fromEntries(WIDGETS.map((w) => [w, 'loading'])));
    server.state.flaky = 1; // /transactions will hiccup once
    await Promise.all(
      WIDGETS.map(async (w) => {
        try {
          await call({ method: 'GET', path: `/${w}` });
          setWidgets((s) => ({ ...s, [w]: 'ok' }));
        } catch (e) {
          c.log(`${w}: ${(e as Error).message}`, 'bad');
          setWidgets((s) => ({ ...s, [w]: 'error' }));
          toast((e as HttpError).status === 401 ? 'Your session ended. Please sign in again.' : 'Something went wrong');
        }
      }),
    );
    force((n) => n + 1);
  };

  const transfer = async () => {
    c.log('— POST /transfers €50 —', 'info');
    server.state.flaky = 1; // the bank commits, then the gateway times out
    const req: Req = { method: 'POST', path: '/transfers', key: fixed ? crypto.randomUUID().slice(0, 8) : undefined };
    try {
      c.log(await call(req), 'good');
    } catch (e) {
      c.log(`transfer: ${(e as Error).message}`, 'bad');
      toast('Something went wrong');
    }
    force((n) => n + 1);
  };

  const s = server.state;
  return (
    <Stack gap={12}>
      <Browser url="bank.example.com/dashboard">
        <Stack gap={10}>
          {s.revoked && <Badge tone="bad">Logged out: session revoked by the server</Badge>}
          <Row gap={6}>
            {WIDGETS.map((w) => {
              const st = widgets[w] ?? 'idle';
              return (
                <Badge key={w} tone={st === 'ok' ? 'good' : st === 'error' ? 'bad' : st === 'loading' ? 'info' : 'neutral'}>
                  {w}
                  {st === 'loading' ? '…' : st === 'ok' ? ' ✓' : st === 'error' ? ' ✕' : ''}
                </Badge>
              );
            })}
          </Row>
          {toasts.length > 0 && (
            <Stack gap={4}>
              {toasts.map((t) => (
                <div
                  key={t.id}
                  style={{ padding: '6px 10px', borderRadius: 8, fontSize: 13, background: 'var(--bad-soft)', color: 'var(--bad)' }}
                >
                  {t.text}
                </div>
              ))}
            </Stack>
          )}
        </Stack>
      </Browser>

      <Row gap={6}>
        <Button
          onClick={() => {
            server.state.access = 'expired';
            c.log('15 minutes later: access token expired', 'info');
          }}
        >
          Wait 15 min
        </Button>
        <Button tone="primary" onClick={refreshDashboard}>
          Refresh dashboard
        </Button>
        <Button onClick={transfer} disabled={s.revoked}>
          Transfer €50
        </Button>
        <Button tone="ghost" onClick={reset}>
          Reset
        </Button>
      </Row>

      <Row gap={8}>
        <Stat label="refresh calls" value={refreshCalls} tone={refreshCalls > 1 ? 'bad' : refreshCalls === 1 ? 'good' : 'neutral'} />
        <Stat label="toasts shown" value={toasts.length} tone={toasts.length > 1 ? 'bad' : 'neutral'} />
        <Stat label="€50 transfers on server" value={s.transfers} tone={s.transfers > 1 ? 'bad' : s.transfers === 1 ? 'good' : 'neutral'} />
      </Row>

      <Code>
        {fixed
          ? `refreshPromise ??= refresh().finally(() => refreshPromise = null);\nawait refreshPromise;                      // all 401s share it\nif (isIdempotent(req) || req.headers['Idempotency-Key'])\n  await sleep(Math.random() * 300 * 2 ** n); // backoff + jitter`
          : `if (status === 401) {\n  const { data } = await post('/auth/refresh'); // one per 401\n  return api(config);\n}\nif (status >= 500) return api(config);        // POST too, instantly`}
      </Code>
      <Console lines={c.lines} height={150} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <Resettable>{(reset) => <Dashboard fixed={false} reset={reset} />}</Resettable>;
}

export function Solution() {
  return <Resettable>{(reset) => <Dashboard fixed reset={reset} />}</Resettable>;
}
