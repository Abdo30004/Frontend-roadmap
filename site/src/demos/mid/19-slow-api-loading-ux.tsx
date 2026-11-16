import { useEffect, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Note, Row, Stack, Stat, fakeRequest, useConsole } from '../../demo-kit';

export const scenario = 'An insurance comparison site fetches car-insurance quotes from an aggregator that takes several seconds to answer.';
export const task = 'Click "Get quotes", then click it again because nothing seems to happen. Try "Server stuck" and "Save" on a quote too.';
export const solutionNote = 'Same page: skeleton + progress text, cached results, Cancel and an 8 s timeout, and an optimistic "Save".';

interface Quote { id: string; insurer: string; price: number }
const QUOTES: Quote[] = [
  { id: 'q1', insurer: 'Allsure', price: 412 },
  { id: 'q2', insurer: 'Northwind Mutual', price: 438 },
  { id: 'q3', insurer: 'Blue Fox', price: 455 },
];
const TIMEOUT = 8000;

function QuotesPage({ fixed }: { fixed: boolean }) {
  const [latency, setLatency] = useState(5000);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [cached, setCached] = useState<Quote[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sent, setSent] = useState(0);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const ctrl = useRef<AbortController | null>(null);
  const life = useRef(new AbortController()); // aborts every pending request on unmount
  const started = useRef(0);
  const c = useConsole();

  useEffect(() => () => { ctrl.current?.abort(); life.current.abort(); }, []);
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setElapsed(Date.now() - started.current), 250);
    return () => clearInterval(id);
  }, [loading]);

  const load = async () => {
    const n = sent + 1;
    setSent(n);
    started.current = Date.now();
    setElapsed(0);
    setError(null);
    setLoading(true);
    if (!fixed) {
      // The real bug: no feedback, no cancel, no timeout; every click starts another request.
      setQuotes(null);
      c.log(`request #${n} sent (GET /api/quotes?car=golf)`, 'warn');
      try {
        const data = await fakeRequest(QUOTES, { delay: latency, signal: life.current.signal });
        setQuotes(data);
        setLoading(false);
        c.log(`request #${n} answered after ${(latency / 1000).toFixed(0)} s`, 'info');
      } catch { /* unmounted */ }
      return;
    }
    ctrl.current?.abort(); // a new search cancels the old one
    const ctl = new AbortController();
    ctrl.current = ctl;
    const timer = setTimeout(() => ctl.abort(new DOMException('Timed out', 'TimeoutError')), TIMEOUT);
    c.log(`request #${n} sent (timeout ${TIMEOUT / 1000} s)`, 'info');
    try {
      const data = await fakeRequest(QUOTES, { delay: latency, signal: ctl.signal });
      setQuotes(data);
      setCached(data);
      setLoading(false);
      c.log(`request #${n} answered, cached for next visit`, 'good');
    } catch {
      if (ctrl.current !== ctl) return; // superseded by a newer request
      const timedOut = Date.now() - started.current >= TIMEOUT - 50;
      setLoading(false);
      setError(timedOut ? 'This is taking longer than usual.' : 'Search cancelled.');
      c.log(timedOut ? `request #${n} timed out after ${TIMEOUT / 1000} s` : `request #${n} cancelled`, 'warn');
    } finally {
      clearTimeout(timer);
    }
  };

  const toggleSave = async (id: string) => {
    const next = !saved[id];
    if (fixed) setSaved((s) => ({ ...s, [id]: next })); // optimistic: the UI answers now
    c.log(`PUT /saved/${id} (${next ? 'save' : 'unsave'})…`);
    try { await fakeRequest(null, { delay: 1500, signal: life.current.signal }); } catch { return; }
    if (!fixed) setSaved((s) => ({ ...s, [id]: next })); // waits for the server
    c.log(`saved/${id} confirmed by server`, 'info');
  };

  const shown = quotes ?? (fixed ? cached : null);
  const secs = (elapsed / 1000).toFixed(1);

  return (
    <Stack gap={14}>
      <Row gap={6}>
        <Badge tone="neutral">Aggregator latency:</Badge>
        <Button tone={latency === 5000 ? 'primary' : 'default'} onClick={() => setLatency(5000)}>~5 s</Button>
        <Button tone={latency === 15000 ? 'primary' : 'default'} onClick={() => setLatency(15000)}>Server stuck (15 s)</Button>
      </Row>
      <Browser url="comparecover.example/quotes?car=vw-golf-2021">
          <Stack gap={10}>
            <Row>
              <strong style={{ flex: '1 1 auto' }}>VW Golf 2021 · 1.5 TSI</strong>
              <Button tone="primary" onClick={load} disabled={fixed && loading}>{fixed && loading ? 'Comparing…' : 'Get quotes'}</Button>
              {fixed && loading && <Button tone="ghost" onClick={() => ctrl.current?.abort()}>Cancel</Button>}
            </Row>
            {fixed && loading && <Note>{elapsed > 3000 ? `Still comparing 40+ insurers (${secs} s). This usually takes under 10 seconds.` : 'Comparing 40+ insurers…'}</Note>}
            {error && <Row><Badge tone="warn">{error}</Badge><Button onClick={load}>Retry</Button></Row>}
            {fixed && loading && !shown && [0, 1, 2].map((i) => <div key={i} aria-hidden style={{ height: 38, borderRadius: 8, background: 'var(--paper-2)' }} />)}
            {shown && (
              <Stack gap={6} style={{ opacity: fixed && loading ? 0.6 : 1, transition: 'opacity 200ms ease' }}>
                {fixed && loading && <Badge tone="info">Showing your last results · updating…</Badge>}
                {shown.map((q) => (
                  <Row key={q.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px' }}>
                    <span style={{ flex: '1 1 auto' }}>{q.insurer}</span>
                    <strong>${q.price}/yr</strong>
                    <Button tone="ghost" onClick={() => toggleSave(q.id)} aria-pressed={!!saved[q.id]}>{saved[q.id] ? '★ Saved' : '☆ Save'}</Button>
                  </Row>
                ))}
              </Stack>
            )}
            {!fixed && loading && <div style={{ minHeight: 120 }} /> /* no feedback at all */}
            {!shown && !loading && !error && <Note>No quotes yet.</Note>}
          </Stack>
      </Browser>
      <Row gap={8}>
        <Stat label="requests sent" value={sent} tone={!fixed && sent > 1 ? 'bad' : 'neutral'} />
        <Stat label="waiting" value={loading ? `${secs} s` : '–'} tone={loading ? (fixed ? 'info' : 'bad') : 'neutral'} />
      </Row>
      <Code>{fixed
        ? `const signal = AbortSignal.any([ctl.signal, AbortSignal.timeout(8000)]);
{isPending ? <Skeleton rows={3} /> : <QuoteList quotes={data ?? cached} />}
setSaved(id, true); api.save(id).catch(() => setSaved(id, false)); // optimistic`
        : `setQuotes(null);
fetch('/api/quotes?car=golf').then(r => r.json()).then(setQuotes); // no timeout, no cancel
if (!quotes) return <div />;  // the whole page disappears`}</Code>
      <Console lines={c.lines} height={120} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <QuotesPage fixed={false} />;
}

export function Solution() {
  return <QuotesPage fixed />;
}
