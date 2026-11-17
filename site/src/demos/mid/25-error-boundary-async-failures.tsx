import { Component, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Badge, Browser, Button, Code, Console, Note, Panel, Row, Stack, Stat, fakeRequest, useConsole } from '../../demo-kit';

export const scenario =
  'A patient portal dashboard wraps its "Lab results" widget in an Error Boundary, so one broken widget shows a retry card instead.';
export const task = 'Click "Open dashboard" while the lab API is broken. Wait, then look at the widget and the console.';
export const solutionNote =
  'Same widget: the async error is moved into render (setState(() => { throw err })), so the boundary catches it.';

const HTML_ERROR_PAGE = '<!doctype html><html><body>502 Bad Gateway</body></html>';
const LABS = JSON.stringify([
  { test: 'Hemoglobin', value: '13.8 g/dL', ok: true },
  { test: 'LDL cholesterol', value: '162 mg/dL', ok: false },
]);
type Lab = { test: string; value: string; ok: boolean };
type Log = (text: string, tone?: 'bad' | 'good' | 'info' | 'warn') => void;

class ErrorBoundary extends Component<{ children: ReactNode; onError: Log; onReset: () => void }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    this.props.onError(`ErrorBoundary caught: ${error.name}: ${error.message}`, 'good');
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Panel tone="bad">
        <Stack gap={8}>
          <strong>Couldn't load your lab results.</strong>
          <Row>
            <Button
              onClick={() => {
                this.setState({ error: null });
                this.props.onReset();
              }}
            >
              Try again
            </Button>
          </Row>
        </Stack>
      </Panel>
    );
  }
}

// The hand-written `showBoundary`: an updater that throws runs during render, where boundaries can see it.
function useShowBoundary() {
  const [, setState] = useState(0);
  return useCallback(
    (err: unknown) =>
      setState(() => {
        throw err;
      }),
    [],
  );
}

function LabResults({ fixed, broken, log }: { fixed: boolean; broken: boolean; log: Log }) {
  const [results, setResults] = useState<Lab[] | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const showBoundary = useShowBoundary();

  useEffect(() => {
    const ctl = new AbortController();
    log('GET /api/patients/p_31/labs …', 'info');
    const request = fakeRequest(broken ? HTML_ERROR_PAGE : LABS, { delay: 1200, signal: ctl.signal })
      .then((text) => JSON.parse(text) as Lab[]) // real JSON.parse: throws on the HTML error page
      .then(setResults);
    if (fixed) {
      request.catch((err: Error) => {
        if (err.name !== 'AbortError') showBoundary(err);
      });
    } else {
      // Nothing in the component handles the rejection. Demo only: we catch it here so it does not
      // reach window, and print what the browser would print.
      request.catch((err: Error) => {
        if (err.name === 'AbortError') return;
        log(`Uncaught (in promise) ${err.name}: ${err.message}`, 'bad');
        log('…the ErrorBoundary never saw it: it only catches errors thrown while rendering.', 'warn');
      });
    }
    return () => ctl.abort();
  }, [fixed, broken, log, showBoundary]);

  const downloadPdf = async () => {
    try {
      await fakeRequest(null, { delay: 600, fail: '401 session expired' });
    } catch (err) {
      if (fixed) {
        setPdfError(true);
        log(`download failed, shown to the user: ${(err as Error).message}`, 'good');
        return;
      }
      log(`Uncaught (in promise) Error: Download failed (${(err as Error).message}). Nothing on screen.`, 'bad'); // demo-only catch
    }
  };

  if (!results)
    return (
      <Row>
        <span aria-hidden>⟳</span>
        <Note>Loading your lab results…</Note>
      </Row>
    );
  return (
    <Stack gap={6}>
      {results.map((r) => (
        <Row key={r.test}>
          <span style={{ flex: '1 1 auto' }}>{r.test}</span>
          <Badge tone={r.ok ? 'good' : 'warn'}>{r.value}</Badge>
        </Row>
      ))}
      <Row>
        <Button onClick={downloadPdf}>Download PDF</Button>
        {pdfError && <Badge tone="warn">Couldn't download the PDF. Please sign in again.</Badge>}
      </Row>
    </Stack>
  );
}

function Dashboard({ fixed }: { fixed: boolean }) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const c = useConsole();
  const log = c.log as Log;

  useEffect(() => {
    if (!open) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [open, attempt]);

  return (
    <Stack gap={14}>
      <Row>
        <Button
          tone="primary"
          onClick={() => {
            c.clear();
            setOpen(true);
            setAttempt((a) => a + 1);
          }}
        >
          {open ? 'Reload dashboard' : 'Open dashboard'}
        </Button>
        <label style={{ fontSize: 13, color: 'var(--ink-2)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={broken} onChange={(e) => setBroken(e.target.checked)} /> Lab API returns an HTML error page
        </label>
      </Row>
      <Browser url="portal.carewell.example/dashboard">
        {!open ? (
          <Note>Dashboard not opened.</Note>
        ) : (
          <Stack gap={10}>
            <Row>
              <strong style={{ flex: '1 1 auto' }}>Hello, Maria</strong>
              <Badge tone="info">Next appointment: 3 Dec</Badge>
            </Row>
            <Panel title="Lab results">
              <ErrorBoundary key={attempt} onError={log} onReset={() => setAttempt((a) => a + 1)}>
                <LabResults fixed={fixed} broken={broken} log={log} />
              </ErrorBoundary>
            </Panel>
          </Stack>
        )}
      </Browser>
      <Row gap={8}>
        <Stat label="seconds since load" value={open ? elapsed : '–'} tone={open && elapsed > 5 ? 'warn' : 'neutral'} />
      </Row>
      <Code>
        {fixed
          ? `const [, setState] = useState();
fetchLabs().then(setResults)
  .catch((err) => setState(() => { throw err; }));  // rethrown during render → boundary`
          : `fetchLabs()                 // JSON.parse throws asynchronously
  .then(setResults);        // no catch: the boundary never sees it, spinner forever`}
      </Code>
      <Console lines={c.lines} height={130} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <Dashboard fixed={false} />;
}

export function Solution() {
  return <Dashboard fixed />;
}
