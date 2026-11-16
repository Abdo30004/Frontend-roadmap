import { useEffect, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Input, Note, Row, Stack, Stat, fakeRequest, useConsole } from '../../demo-kit';

export const scenario = 'A shop search box suggests products as you type. It is meant to call the API only once you stop typing for 300 ms.';
export const task = 'Type "laptop" quickly into the search box, then compare the keystrokes with the requests sent.';
export const solutionNote = 'Same debounce helper, but timerId lives in the outer function, so every call shares it.';

const CATALOG = [
  'Laptop Pro 14"', 'Laptop Air 13"', 'Laptop stand', 'Laptop sleeve', 'Lamp (desk)', 'Lavender soap',
  'Phone case', 'Phone charger', 'Headphones', 'Keyboard', 'Mouse pad', 'Monitor 27"',
];

type Timer = ReturnType<typeof setTimeout>;

// BROKEN: timerId is created inside the returned function, once per call.
function debounceBroken<A extends unknown[]>(fn: (...args: A) => void, delay: number) {
  return (...args: A) => {
    let timerId: Timer | undefined = undefined; // new variable on EVERY call
    clearTimeout(timerId); // always clears undefined
    timerId = setTimeout(() => fn(...args), delay);
  };
}

// FIXED: timerId is created once and shared through the closure.
function debounceFixed<A extends unknown[]>(fn: (...args: A) => void, delay: number) {
  let timerId: Timer | undefined;
  const debounced = (...args: A) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timerId);
  return debounced;
}

function SearchBox({ fixed }: { fixed: boolean }) {
  const [text, setText] = useState('');
  const [keys, setKeys] = useState(0);
  const [requests, setRequests] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const c = useConsole();
  const alive = useRef(true);

  // The search handler. A ref keeps it fresh without recreating the debounced function.
  const search = async (query: string) => {
    if (!alive.current) return;
    setRequests((n) => n + 1);
    c.log(`GET /api/suggest?q=${encodeURIComponent(query)}`, fixed ? 'good' : 'warn');
    setLoading(true);
    const q = query.trim().toLowerCase();
    const result = await fakeRequest(() => (q ? CATALOG.filter((p) => p.toLowerCase().includes(q)).slice(0, 4) : []), { delay: 250 });
    if (!alive.current) return;
    setSuggestions(result);
    setLoading(false);
  };
  const searchRef = useRef(search);
  searchRef.current = search;

  // debounce() runs ONCE for this component, like a module-level helper would.
  const [debounced] = useState(() =>
    fixed
      ? debounceFixed((q: string) => searchRef.current(q), 300)
      : debounceBroken((q: string) => searchRef.current(q), 300),
  );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if ('cancel' in debounced) (debounced as { cancel: () => void }).cancel();
    };
  }, [debounced]);

  const reset = () => {
    setText(''); setKeys(0); setRequests(0); setSuggestions([]); c.clear();
  };

  const perKey = keys > 1 && requests >= keys;

  return (
    <Stack gap={14}>
      <Browser url="shop.example/search">
        <Stack gap={10}>
          <Input
            placeholder="Search products…"
            aria-label="Search products"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setKeys((k) => k + 1);
              debounced(e.target.value);
            }}
          />
          <div style={{ minHeight: 96 }}>
            {loading && <Note>Loading suggestions…</Note>}
            {!loading && suggestions.length > 0 && (
              <Stack gap={4}>
                {suggestions.map((s) => (
                  <div key={s} style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--paper-2)', fontSize: 14 }}>{s}</div>
                ))}
              </Stack>
            )}
            {!loading && suggestions.length === 0 && <Note>Suggestions appear here.</Note>}
          </div>
        </Stack>
      </Browser>
      <Row gap={10}>
        <Stat label="keystrokes" value={keys} />
        <Stat label="API requests" value={requests} tone={requests === 0 ? 'neutral' : perKey ? 'bad' : 'good'} />
        {requests > 0 && <Badge tone={perKey ? 'bad' : 'good'}>{perKey ? 'one request per keystroke' : 'waits until you stop typing'}</Badge>}
        <Button tone="ghost" onClick={reset}>Reset</Button>
      </Row>
      <Code>{fixed
        ? `function debounce(fn, delay) {\n  let timerId;               // shared by every call\n  return (...args) => {\n    clearTimeout(timerId);\n    timerId = setTimeout(() => fn(...args), delay);\n  };\n}`
        : `function debounce(fn, delay) {\n  return (...args) => {\n    let timerId;             // new one per call\n    clearTimeout(timerId);\n    timerId = setTimeout(() => fn(...args), delay);\n  };\n}`}</Code>
      <Console lines={c.lines} height={120} title="Network" onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <SearchBox fixed={false} />;
}

export function Solution() {
  return <SearchBox fixed />;
}
