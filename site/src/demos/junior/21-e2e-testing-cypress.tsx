import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Badge, Browser, Button, Code, Console, Row, Stack, Stat, fakeRequest, sleep, useConsole } from '../../demo-kit';

export const scenario =
  'A travel site runs an end-to-end test on every pull request: search "Lisbon", expect hotel results. The search API takes 0.25 to 1.25 s.';
export const task = 'Press "Run 5×" (and again if you like). Watch the run history and the command log.';
export const solutionNote = 'Same app and same API, but the test waits on an assertion that retries instead of a fixed sleep.';

const HOTELS = ['Casa do Rio', 'Alfama Loft', 'Hotel Miradouro'];

/** The real app under test. Its search API has a random latency, like a real backend. */
function HotelSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const id = useId();
  const ctrl = useRef(new AbortController());
  useEffect(() => () => ctrl.current.abort(), []);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResults(null);
    try {
      const r = await fakeRequest(HOTELS, { delay: [250, 1250], signal: ctrl.current.signal });
      setResults(r);
      setLoading(false);
    } catch {
      /* unmounted */
    }
  };

  return (
    <Stack gap={8}>
      <form onSubmit={search} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label htmlFor={id} style={{ fontSize: 13, color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          Destination
          <input id={id} className="dk-input" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 150 }} />
        </label>
        <button className="dk-btn btn-primary" data-tone="primary">
          Search
        </button>
      </form>
      {loading && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Searching hotels…</div>}
      {results && (
        <Row gap={6}>
          {results.map((h) => (
            <span key={h} className="result-card" data-testid="hotel-card">
              <Badge tone="info">🏨 {h}</Badge>
            </span>
          ))}
        </Row>
      )}
    </Stack>
  );
}

function type(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function E2ERunner({ fixed }: { fixed: boolean }) {
  const [mountKey, setMountKey] = useState(0);
  const [history, setHistory] = useState<{ ok: boolean; ms: number }[]>([]);
  const [running, setRunning] = useState(false);
  const log = useConsole(80);
  const app = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const runOnce = async (n: number) => {
    log.log(`── run #${n} ──`, 'neutral');
    setMountKey((k) => k + 1); // cy.visit('/')
    await sleep(50);
    const root = app.current;
    if (!root || !alive.current) return null;
    const t0 = performance.now();
    const input = root.querySelector('input');
    const btn = root.querySelector('button');
    if (!input || !btn) return null;
    type(input, 'Lisbon');
    btn.click();
    log.log('type "Lisbon" · click Search');
    let ok: boolean;
    if (fixed) {
      log.log('find hotel-card · should have length 3 (retrying up to 4s)', 'info');
      const end = t0 + 4000;
      while (root.querySelectorAll('[data-testid="hotel-card"]').length !== 3 && performance.now() < end) await sleep(30);
      ok = root.querySelectorAll('[data-testid="hotel-card"]').length === 3;
    } else {
      log.log('wait 1000ms', 'info');
      await sleep(1000);
      ok = root.querySelectorAll('.result-card').length > 0; // checked once, never retried
    }
    if (!alive.current) return null;
    const ms = Math.round(performance.now() - t0);
    log.log(
      ok ? `✓ 3 hotel cards found · ${ms} ms` : `✗ expected .result-card to exist, found 0 (API was still loading) · ${ms} ms`,
      ok ? 'good' : 'bad',
    );
    return { ok, ms };
  };

  const run = async (times: number) => {
    setRunning(true);
    for (let i = 0; i < times; i++) {
      const r = await runOnce(history.length + i + 1);
      if (!r) return;
      setHistory((h) => [...h, r].slice(-20));
    }
    setRunning(false);
  };

  const passed = history.filter((h) => h.ok).length;
  const failed = history.length - passed;
  const avg = history.length ? Math.round(history.reduce((s, h) => s + h.ms, 0) / history.length) : 0;

  return (
    <Stack gap={14}>
      <Browser url="staging.trips.example">
        <div ref={app} key={mountKey}>
          <HotelSearch />
        </div>
      </Browser>

      <Row>
        <Button tone="primary" onClick={() => run(5)} disabled={running}>
          {running ? 'Running…' : 'Run 5×'}
        </Button>
        <Button onClick={() => run(1)} disabled={running}>
          Run once
        </Button>
        <Button
          tone="ghost"
          onClick={() => {
            setHistory([]);
            log.clear();
          }}
          disabled={running}
        >
          Clear
        </Button>
      </Row>

      <Row gap={4}>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', marginRight: 4 }}>History:</span>
        {history.length === 0 && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>no runs yet</span>}
        {history.map((h, i) => (
          <span
            key={i}
            title={`${h.ms} ms`}
            style={{ width: 14, height: 14, borderRadius: 4, display: 'inline-block', background: h.ok ? 'var(--good)' : 'var(--bad)' }}
          />
        ))}
      </Row>

      <Row gap={8}>
        <Stat label="passed" value={passed} tone={passed ? 'good' : 'neutral'} />
        <Stat label="failed (same code!)" value={failed} tone={failed ? 'bad' : 'neutral'} />
        <Stat label="avg run time" value={avg ? `${avg} ms` : '-'} />
      </Row>

      <Console title="Cypress command log" lines={log.lines} height={140} onClear={log.clear} />
      <Code>
        {fixed
          ? `cy.intercept("GET", "/api/hotels*").as("searchHotels");\ncy.findByLabelText(/destination/i).type("Lisbon");\ncy.findByRole("button", { name: /search/i }).click();\ncy.wait("@searchHotels");\ncy.findAllByTestId("hotel-card").should("have.length", 3); // retries`
          : `cy.get("form > label > input").type("Lisbon");\ncy.get(".btn-primary").click();\ncy.wait(1000);                     // hope the API is done\ncy.get("body").then(($b) => {\n  expect($b.find(".result-card").length).to.be.greaterThan(0); // no retry\n});`}
      </Code>
    </Stack>
  );
}

export function Problem() {
  return <E2ERunner fixed={false} />;
}

export function Solution() {
  return <E2ERunner fixed />;
}
