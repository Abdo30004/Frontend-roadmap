# Why doesn't an Error Boundary catch an async failure?

**Level:** Mid
**Merged from (original phrasings):**
- Why doesn't an Error Boundary catch an async failure?

## The concept (short answer)
- An Error Boundary is a class component (`getDerivedStateFromError` / `componentDidCatch`). React only catches errors thrown **while it is calling your code during rendering**: render functions, lifecycle methods, constructors, and (via the commit phase) effects' synchronous bodies.
- Errors that happen **outside that call stack** are not caught:
  - **Event handlers** (`onClick`): React calls them, but they are not part of rendering, and the UI is still consistent, so React leaves them to you.
  - **Async code:** `fetch().then`, `async` functions after an `await`, `setTimeout`, `setInterval`, WebSocket callbacks. By the time they throw, the render call stack is gone, and the error becomes an unhandled promise rejection or a global error.
  - SSR errors and errors thrown inside the boundary component itself.
- **Fixes:**
  - Catch the async error and **move it into the render phase**: `setState(() => { throw error; })` rethrows it during the next render, where the boundary catches it.
  - Use **`react-error-boundary`**: `useErrorBoundary()` gives `showBoundary(error)`, which does exactly that, plus `resetKeys` and a retry function.
  - Use **Suspense-based data fetching** (`use(promise)` in React 19, React Query/SWR `suspense` mode / `useSuspenseQuery`, Server Components): a rejected promise is thrown during render, so the nearest boundary catches it.
  - Next.js App Router: `error.js` per route segment is an Error Boundary built in.
- Still add a global `window.addEventListener('unhandledrejection', ...)` (or Sentry) for errors no boundary catches.

## Real-life example: the problem
In a healthcare patient portal, the "Lab results" widget is wrapped in an Error Boundary so that one broken widget can't take down the dashboard. When the lab API started returning malformed JSON, the boundary never showed its "Couldn't load results, retry" fallback. Instead, the widget showed an endless spinner, the console showed `Uncaught (in promise) SyntaxError: Unexpected token '<'`, and patients assumed their results were still pending. Clicking "Download PDF" with an expired session also failed silently.

```jsx
<ErrorBoundary fallback={<WidgetError />}>
  <LabResults patientId={id} />
</ErrorBoundary>

function LabResults({ patientId }) {
  const [results, setResults] = useState(null);

  useEffect(() => {
    fetch(`/api/patients/${patientId}/labs`)
      .then(r => r.json())                 // throws SyntaxError asynchronously, not caught by the boundary
      .then(setResults);
  }, [patientId]);

  async function downloadPdf() {
    const res = await fetch(`/api/patients/${patientId}/labs.pdf`);
    if (!res.ok) throw new Error('Download failed'); // event handler + async, not caught by the boundary
    saveBlob(await res.blob());
  }

  if (!results) return <Spinner />;        // stays forever
  return <ResultsTable results={results} onDownload={downloadPdf} />;
}
```

## How to fix it
**Option 1: `react-error-boundary` + `showBoundary`.**
```jsx
import { ErrorBoundary, useErrorBoundary } from 'react-error-boundary';

function LabResults({ patientId }) {
  const [results, setResults] = useState(null);
  const { showBoundary } = useErrorBoundary();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/patients/${patientId}/labs`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`Labs API ${r.status}`); return r.json(); })
      .then(setResults)
      .catch(err => { if (err.name !== 'AbortError') showBoundary(err); }); // moved into render phase
    return () => controller.abort();
  }, [patientId, showBoundary]);

  async function downloadPdf() {
    try {
      const res = await fetch(`/api/patients/${patientId}/labs.pdf`);
      if (!res.ok) throw new Error('Download failed');
      saveBlob(await res.blob());
    } catch (err) {
      toast.error('Could not download the PDF. Please try again.'); // local, recoverable: no need to replace the widget
    }
  }

  if (!results) return <Spinner />;
  return <ResultsTable results={results} onDownload={downloadPdf} />;
}

// usage, with retry and reset when the patient changes
<ErrorBoundary
  FallbackComponent={({ error, resetErrorBoundary }) => (
    <WidgetError message="Couldn't load lab results." onRetry={resetErrorBoundary} />
  )}
  onError={(error) => reportToSentry(error)}
  resetKeys={[id]}
>
  <LabResults patientId={id} />
</ErrorBoundary>
```

Without the library, the same trick works by hand:
```jsx
const [, setState] = useState();
// ...
.catch(err => setState(() => { throw err; })); // the updater runs during render, so the boundary catches it
```

**Option 2: Suspense + `use` (React 19) or a suspense query, so errors are thrown during render naturally.**
```jsx
function LabResults({ labsPromise }) {
  const results = use(labsPromise);   // rejected promise is thrown during render, caught by the boundary
  return <ResultsTable results={results} />;
}

<ErrorBoundary FallbackComponent={LabsError}>
  <Suspense fallback={<Spinner />}>
    <LabResults labsPromise={labsPromise} />   {/* promise created by a parent, router loader, or Server Component */}
  </Suspense>
</ErrorBoundary>
```

Why it works: Error Boundaries only handle errors thrown during rendering. `showBoundary` or the throwing state updater schedules a re-render that throws, and `use()` throws the rejection while rendering, so in both cases the error happens where React can catch it and show the fallback. For event handlers, a local try/catch with a toast is usually better UX than replacing the whole widget.

## How to say it in the interview
- "Boundaries catch errors thrown during rendering. Event handlers and async callbacks run later, outside React's render call stack, so the error never reaches the boundary. It becomes an unhandled rejection."
- "To route an async error to a boundary I rethrow it during render: `showBoundary` from react-error-boundary, a throwing state updater, or Suspense-based fetching with `use()` or `useSuspenseQuery`."
- Trap: wrapping `await` in try/catch and then doing nothing gives an endless spinner. Every async path needs an explicit error state or a boundary.
- Trade-off: not every error should replace the UI with a fallback. Recoverable action errors (a failed download or save) are better as inline messages or toasts, while broken data for a whole section belongs in a boundary.
