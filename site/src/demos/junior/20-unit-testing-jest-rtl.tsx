import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Badge, Browser, Button, Code, Console, Row, Stack, Stat, fakeRequest, sleep, useConsole } from '../../demo-kit';

export const scenario = 'A newsletter sign-up form with a green test suite. A teammate refactors its markup to CSS Modules; what users see stays the same.';
export const task = 'Press "Run tests" (all green). Then press "Refactor component" and "Run tests" again.';
export const solutionNote = 'Same component and refactor, but the tests query by label, role and text, like a user.';

/** Shared behavior: the refactor below only touches markup, never this logic. */
function useSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const ctrl = useRef(new AbortController());
  useEffect(() => () => ctrl.current.abort(), []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      await fakeRequest(true, { delay: 300, signal: ctrl.current.signal });
      setStatus('success');
    } catch { /* unmounted */ }
  };
  return { email, setEmail, status, submit };
}

function FormV1() {
  const s = useSignup();
  const id = useId();
  if (s.status === 'success') return <p className="signup__success">Thanks! Check your inbox.</p>;
  return (
    <form className="signup" onSubmit={s.submit}>
      <label htmlFor={id} className="signup__label">Email</label>{' '}
      <input id={id} className="signup__input dk-input" type="email" value={s.email} onChange={(e) => s.setEmail(e.target.value)} />{' '}
      <button className="signup__btn dk-btn" data-tone="primary" disabled={s.status === 'loading'}>Subscribe</button>
    </form>
  );
}

function FormV2() {
  const s = useSignup();
  const id = useId();
  if (s.status === 'success') return <div role="status" className="_done_9ab3">Thanks! Check your inbox.</div>;
  return (
    <form className="_form_k21x" onSubmit={s.submit}>
      <div className="_field_3kq1">
        <label htmlFor={id}>Email</label>{' '}
        <input id={id} className="_input_x7f2 dk-input" type="email" value={s.email} onChange={(e) => s.setEmail(e.target.value)} />
      </div>
      <div className="_actions_p0d4" style={{ marginTop: 8 }}>
        <button className="_cta_ab12 dk-btn" data-tone="primary" disabled={s.status === 'loading'}>Subscribe</button>
      </div>
    </form>
  );
}

/* ---------- a tiny test runner that drives the real DOM above ---------- */

type Root = HTMLElement;
const nullErr = (what: string) => new Error(`TypeError: Cannot read properties of null (${what})`);
function type(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
async function waitFor<T>(fn: () => T | null | undefined, fail: string, timeout = 1500): Promise<T> {
  const end = performance.now() + timeout;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (performance.now() > end) throw new Error(fail);
    await sleep(40);
  }
}
const getByLabelText = (root: Root, re: RegExp) => {
  const label = Array.from(root.querySelectorAll('label')).find((l) => re.test(l.textContent ?? ''));
  if (!(label?.control instanceof HTMLInputElement)) throw new Error(`Unable to find a label with the text of: ${re}`);
  return label.control;
};
const getByRole = (root: Root, role: 'button', re: RegExp) => {
  const el = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => re.test(b.textContent ?? ''));
  if (!el) throw new Error(`Unable to find role="${role}" and name ${re}`);
  return el;
};
const findByText = (root: Root, re: RegExp) =>
  waitFor(() => Array.from(root.querySelectorAll('*')).find((el) => el.children.length === 0 && re.test(el.textContent ?? '')), `Unable to find text ${re}`);

interface Test { name: string; fn: (root: Root, snapshot: string) => Promise<void> }

const BRITTLE: Test[] = [
  { name: 'signup form submits', fn: async (root) => {
    const input = root.querySelector<HTMLInputElement>('.signup__input');
    if (!input) throw nullErr("reading 'value'");
    type(input, 'ana@example.com');
    const btn = root.querySelector<HTMLButtonElement>('.signup__btn');
    if (!btn) throw nullErr("reading 'click'");
    btn.click();
    await waitFor(() => root.querySelector('.signup__success'), 'expected .signup__success to exist');
  } },
  { name: 'matches snapshot', fn: async (root, snapshot) => {
    const norm = (html: string) => html.replace(/(id|for)="[^"]*"/g, '$1="email"').split('><');
    const now = norm(root.innerHTML);
    const old = norm(snapshot);
    const changed = Math.max(now.length, old.length) - now.filter((l, i) => l === old[i]).length;
    if (changed > 0) throw new Error(`Snapshot mismatch: ${changed} lines changed (run with -u to update)`);
  } },
];

const RTL: Test[] = [
  { name: 'subscribes the user and shows a confirmation', fn: async (root) => {
    type(getByLabelText(root, /email/i), 'ana@example.com');
    getByRole(root, 'button', /subscribe/i).click();
    await findByText(root, /thanks! check your inbox/i);
  } },
  { name: 'disables the button while the request is pending', fn: async (root) => {
    type(getByLabelText(root, /email/i), 'ana@example.com');
    getByRole(root, 'button', /subscribe/i).click();
    await sleep(0);
    if (!getByRole(root, 'button', /subscribe/i).disabled) throw new Error('expected button toBeDisabled()');
  } },
];

function TestRunner({ fixed }: { fixed: boolean }) {
  const [refactored, setRefactored] = useState(false);
  const [mountKey, setMountKey] = useState(0);
  const [results, setResults] = useState<{ name: string; ok: boolean }[]>([]);
  const [running, setRunning] = useState(false);
  const out = useConsole();
  const preview = useRef<HTMLDivElement>(null);
  const snapshot = useRef('');
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  // The snapshot was recorded when the test was first written (original markup).
  useLayoutEffect(() => { snapshot.current = preview.current?.innerHTML ?? ''; }, []);

  const suite = fixed ? RTL : BRITTLE;
  const run = async () => {
    setRunning(true);
    setResults([]);
    out.clear();
    out.log(`$ jest SignupForm.test.jsx`, 'neutral');
    const res: { name: string; ok: boolean }[] = [];
    for (const t of suite) {
      setMountKey((k) => k + 1); // fresh render for every test
      await sleep(60);
      if (!alive.current || !preview.current) return;
      try {
        await t.fn(preview.current, snapshot.current);
        res.push({ name: t.name, ok: true });
        out.log(`  ✓ ${t.name}`, 'good');
      } catch (e) {
        res.push({ name: t.name, ok: false });
        out.log(`  ✕ ${t.name}\n      ${(e as Error).message}`, 'bad');
      }
      setResults([...res]);
    }
    const failed = res.filter((r) => !r.ok).length;
    out.log(failed ? `FAIL  ${failed} failed, ${res.length - failed} passed` : `PASS  ${res.length} passed`, failed ? 'bad' : 'good');
    setMountKey((k) => k + 1);
    setRunning(false);
  };

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  return (
    <Stack gap={14}>
      <Browser url="localhost:5173/newsletter">
        <div ref={preview} key={mountKey} style={{ minHeight: 70 }}>{refactored ? <FormV2 /> : <FormV1 />}</div>
      </Browser>
      <Row>
        <Button onClick={() => { setRefactored(true); out.log('refactor: classNames → CSS Modules, extra wrapper divs, success uses role="status"', 'info'); }} disabled={refactored || running}>
          Refactor component
        </Button>
        <Button tone="primary" onClick={run} disabled={running}>{running ? 'Running…' : 'Run tests'}</Button>
        <Button tone="ghost" onClick={() => { setRefactored(false); setResults([]); out.clear(); }} disabled={running}>Reset</Button>
      </Row>
      <Row gap={8}>
        <Stat label="tests passed" value={passed} tone={results.length ? 'good' : 'neutral'} />
        <Stat label="tests failed" value={failed} tone={failed ? 'bad' : 'neutral'} />
        <Badge tone={refactored ? 'info' : 'neutral'}>{refactored ? 'Markup refactored · behavior for users unchanged' : 'Original markup'}</Badge>
      </Row>
      <Console title="Test runner" lines={out.lines} height={150} onClear={out.clear} />
      <Code>{fixed
        ? `await user.type(screen.getByLabelText(/email/i), "ana@example.com");\nawait user.click(screen.getByRole("button", { name: /subscribe/i }));\nexpect(await screen.findByText(/thanks/i)).toBeInTheDocument();`
        : `const input = container.querySelector(".signup__input");\nfireEvent.change(input, { target: { value: "ana@example.com" } });\nfireEvent.click(container.querySelector(".signup__btn"));\nexpect(container).toMatchSnapshot();`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <TestRunner fixed={false} />;
}

export function Solution() {
  return <TestRunner fixed />;
}
