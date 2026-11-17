import { useEffect, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Input, Note, Row, Stack, Stat, fakeRequest, sleep, useConsole } from '../../demo-kit';

export const scenario =
  'A flight search page suggests departure airports while you type a city. The airports API is sometimes slow and sometimes flaky.';
export const task = 'Click "Type Paris fast" and look at the results. Then set the API to "flaky" and search a few cities.';
export const solutionNote =
  'Same page: each effect run owns an AbortController + ignore flag, checks res.ok, and retries 5xx with backoff.';

const AIRPORTS = [
  'Paris CDG',
  'Paris Orly',
  'Parma PMF',
  'Paro PBH',
  'Paraná PRA',
  'Paramaribo PBM',
  'Lisbon LIS',
  'London LHR',
  'London Gatwick LGW',
  'Lyon LYS',
  'Porto OPO',
  'Prague PRG',
  'Rome FCO',
  'Madrid MAD',
];
type Mode = 'healthy' | 'flaky' | 'down';
interface Res {
  ok: boolean;
  status: number;
  body: { items?: string[]; error?: string };
}

/** Fake airports API. "par" matches many rows, so it is slow. Flaky mode fails 60% of calls with a 500. */
function api(q: string, mode: Mode, signal: AbortSignal): Promise<Res> {
  const delay = q === 'par' ? 1500 : 250 + Math.random() * 450;
  const fail = mode === 'down' || (mode === 'flaky' && Math.random() < 0.6);
  return fakeRequest<Res>(
    () =>
      fail
        ? { ok: false, status: 500, body: { error: 'Internal Server Error' } }
        : { ok: true, status: 200, body: { items: AIRPORTS.filter((a) => a.toLowerCase().includes(q)) } },
    { delay, signal },
  );
}

class HttpError extends Error {
  constructor(public status: number) {
    super(`Request failed: ${status}`);
  }
}

function FlightSearch({ fixed }: { fixed: boolean }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('healthy');
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; data: unknown; forQ: string; error?: string }>({
    status: 'idle',
    data: null,
    forQ: '',
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [requests, setRequests] = useState(0);
  const latest = useRef('');
  const unmount = useRef(new AbortController());
  const typing = useRef<ReturnType<typeof setTimeout>[]>([]);
  const c = useConsole();
  latest.current = query.trim().toLowerCase();
  useEffect(
    () => () => {
      unmount.current.abort();
      typing.current.forEach(clearTimeout);
    },
    [],
  );

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    if (!fixed) {
      // BUG: no abort, no ignore flag, no res.ok check, no catch
      setState((s) => ({ ...s, status: 'loading' }));
      setRequests((n) => n + 1);
      c.log(`→ GET /api/airports?q=${q}`, 'info');
      api(q, mode, unmount.current.signal)
        .then((res) => {
          const stale = q !== latest.current;
          c.log(`← "${q}" ${res.status}${stale ? '  (old query, but it wins!)' : ''}`, stale || !res.ok ? 'bad' : 'good');
          setState({ status: 'success', data: res.body.items, forQ: q }); // 500 → items is undefined
        })
        .catch(() => {
          /* aborted on unmount */
        });
      return;
    }
    const controller = new AbortController();
    let ignore = false;
    setState((s) => ({ ...s, status: 'loading', error: undefined })); // keep old data while loading
    (async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          setRequests((n) => n + 1);
          c.log(`→ GET /api/airports?q=${q}${attempt ? `  (retry ${attempt})` : ''}`, 'info');
          const res = await api(q, mode, controller.signal);
          if (!res.ok) throw new HttpError(res.status);
          if (!ignore) {
            c.log(`← "${q}" 200`, 'good');
            setState({ status: 'success', data: res.body.items, forQ: q });
          }
          return;
        } catch (err) {
          if (controller.signal.aborted) {
            c.log(`✕ "${q}" aborted (newer query)`, 'warn');
            return;
          }
          if (attempt >= 3 || !(err instanceof HttpError && err.status >= 500)) {
            if (!ignore) {
              c.log(`← "${q}" failed after ${attempt + 1} attempts`, 'bad');
              setState((s) => ({ ...s, status: 'error', error: String(err) }));
            }
            return;
          }
          const delay = Math.round(300 * 2 ** attempt + Math.random() * 200); // backoff + jitter
          c.log(`← "${q}" 500 · retrying in ${delay}ms`, 'warn');
          try {
            await sleep(delay, controller.signal);
          } catch {
            return;
          }
        }
      }
    })();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [query, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const typeFast = () => {
    typing.current.forEach(clearTimeout);
    c.clear();
    ['P', 'Pa', 'Par', 'Pari', 'Paris'].forEach((v, i) => typing.current.push(setTimeout(() => setQuery(v), i * 120)));
  };

  const items = state.data;
  const mismatch = state.status !== 'idle' && state.forQ !== '' && state.forQ !== query.trim().toLowerCase() && state.status !== 'loading';
  return (
    <Stack gap={12}>
      <Browser url="skyfare.example/search">
        <Stack gap={10}>
          <Row gap={8}>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="From: city"
              aria-label="Departure city"
              style={{ flex: '1 1 140px' }}
            />
            <Button tone="primary" onClick={typeFast}>
              Type "Paris" fast
            </Button>
          </Row>
          <Row gap={6}>
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>API:</span>
            {(['healthy', 'flaky', 'down'] as Mode[]).map((m) => (
              <Button key={m} tone={mode === m ? 'primary' : 'ghost'} onClick={() => setMode(m)} style={{ padding: '4px 10px' }}>
                {m}
              </Button>
            ))}
          </Row>
          <Row gap={8}>
            {state.status === 'loading' && <Badge tone="info">loading…</Badge>}
            {state.forQ && <Badge tone={mismatch ? 'bad' : 'good'}>results for "{state.forQ}"</Badge>}
          </Row>
          {state.status === 'error' ? (
            <Row gap={8}>
              <Badge tone="bad">Couldn't load airports</Badge>
              <Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>
            </Row>
          ) : Array.isArray(items) ? (
            <Row gap={6}>{items.length ? items.map((a) => <Badge key={a}>✈ {a}</Badge>) : <Note>No airports.</Note>}</Row>
          ) : state.status !== 'idle' ? (
            <code style={{ color: 'var(--bad)' }}>{String(items)}</code>
          ) : (
            <Note>Type a city.</Note>
          )}
        </Stack>
      </Browser>
      <Row gap={8}>
        <Stat label="requests sent" value={requests} />
        <Stat label="showing results for" value={state.forQ ? `"${state.forQ}"` : '–'} tone={mismatch ? 'bad' : 'neutral'} />
      </Row>
      <Code>
        {fixed
          ? `const controller = new AbortController(); let ignore = false;\nfetchJson(url, { signal: controller.signal, retries: 3 }) // checks res.ok\n  .then((d) => { if (!ignore) setState({ status: 'success', data: d }); })\n  .catch((e) => { if (!ignore) setState({ status: 'error', error: e }); });\nreturn () => { ignore = true; controller.abort(); };`
          : `fetch(\`/api/airports?q=\${query}\`)\n  .then((res) => res.json())     // 500 parsed as data\n  .then((json) => setData(json.items)); // last to ARRIVE wins`}
      </Code>
      <Console lines={c.lines} height={140} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <FlightSearch fixed={false} />;
}

export function Solution() {
  return <FlightSearch fixed />;
}
