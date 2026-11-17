import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Browser, Button, Code, Console, Row, Stack, Stat, fakeRequest, useConsole } from '../../demo-kit';

export const scenario =
  'A B2B SaaS signup form asks for work email, password, company size and an optional VAT number before creating the account.';
export const task =
  'Start typing an email and watch the errors. Then fill it with VAT "FR12", pick a size, and double-click "Create account".';
export const solutionNote =
  'Hand-rolled version of RHF + zod: uncontrolled inputs, one rule set, errors on blur, aria links, number coercion, submit guard.';

type Field = 'email' | 'password' | 'companySize' | 'vat';
type Errors = Partial<Record<Field, string>>;
const FIELDS: Field[] = ['email', 'password', 'companySize', 'vat'];

/** The fixed version's single source of rules (what the zod schema would hold). */
function rule(name: Field, v: string): string | undefined {
  if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid work email';
  if (name === 'password' && v.length < 12) return 'At least 12 characters';
  if (name === 'companySize' && !v) return 'Select a company size';
  if (name === 'vat' && v && !/^[A-Z]{2}[0-9A-Z]{8,12}$/.test(v)) return 'Invalid VAT number (e.g. FR12345678901)';
}

/** The buggy version's ad-hoc check: two rules, VAT and size forgotten. */
function validateBuggy(f: Record<Field, string>): Errors {
  const e: Errors = {};
  if (!f.email.includes('@')) e.email = 'Invalid email';
  if (f.password.length < 8) e.password = 'Too short';
  return e;
}

const inputStyle = {
  font: '14px var(--font-body)',
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  minWidth: 0,
};

function FieldBox({
  id,
  label,
  error,
  linked,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  linked: boolean;
  children: ReactNode;
}) {
  return (
    <Stack gap={4}>
      <label htmlFor={linked ? id : undefined} style={{ fontSize: 13, color: 'var(--ink-2)' }}>
        {label}
      </label>
      {children}
      {error && (
        <span id={linked ? `${id}-error` : undefined} role={linked ? 'alert' : undefined} style={{ fontSize: 12, color: 'var(--bad)' }}>
          {error}
        </span>
      )}
    </Stack>
  );
}

function SignupForm({ fixed }: { fixed: boolean }) {
  const renders = useRef(0);
  renders.current++;
  const c = useConsole();
  const [form, setForm] = useState<Record<Field, string>>({ email: '', password: '', companySize: '', vat: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [accounts, setAccounts] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const setError = (name: Field, msg: string | undefined) => setErrors((e) => (e[name] === msg ? e : { ...e, [name]: msg })); // no re-render if nothing changed

  const send = async (payload: Record<string, unknown>) => {
    c.log(`POST /api/signup ${JSON.stringify(payload)}`, 'info');
    await fakeRequest(null, { delay: 700 });
    setAccounts((n) => n + 1);
    const problems = [
      typeof payload.companySize !== 'number' && 'companySize is a string',
      payload.vat && !/^[A-Z]{2}[0-9A-Z]{8,12}$/.test(String(payload.vat)) && `invalid VAT "${payload.vat}" saved`,
    ].filter(Boolean);
    c.log(`201 account created${problems.length ? ` · DB: ${problems.join(', ')}` : ''}`, problems.length ? 'bad' : 'good');
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fixed) {
      await send(form);
      return;
    } // no check, no double-submit guard
    if (busy.current) return;
    const data = new FormData(e.currentTarget);
    const values = Object.fromEntries(FIELDS.map((f) => [f, String(data.get(f) ?? '').trim()])) as Record<Field, string>;
    const next: Errors = {};
    FIELDS.forEach((f) => {
      const m = rule(f, values[f]);
      if (m) next[f] = m;
    });
    setErrors(next);
    const firstBad = FIELDS.find((f) => next[f]);
    if (firstBad) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstBad}"]`)?.focus();
      return;
    }
    busy.current = true;
    setSubmitting(true);
    await send({ ...values, companySize: Number(values.companySize) }); // coerced like z.coerce.number()
    busy.current = false;
    setSubmitting(false);
  };

  // Buggy: controlled + validate everything on every keystroke. Fixed: uncontrolled, validate on blur (then live once touched).
  const props = (name: Field) =>
    fixed
      ? {
          name,
          id: `f11-${name}`,
          defaultValue: '',
          'aria-invalid': !!errors[name],
          'aria-describedby': errors[name] ? `f11-${name}-error` : undefined,
          onBlur: (ev: { target: { value: string } }) => setError(name, rule(name, ev.target.value.trim())),
          onChange: (ev: { target: { value: string } }) => {
            if (errors[name]) setError(name, rule(name, ev.target.value.trim()));
          },
        }
      : {
          name,
          value: form[name],
          onChange: (ev: { target: { value: string } }) => {
            const next = { ...form, [name]: ev.target.value };
            setForm(next);
            setErrors(validateBuggy(next));
          },
        };

  return (
    <Stack gap={12}>
      <Browser url="app.ledgerly.example/signup">
        <form ref={formRef} onSubmit={onSubmit} noValidate>
          <Stack gap={10}>
            <FieldBox id="f11-email" label="Work email" error={errors.email} linked={fixed}>
              <input type="email" style={inputStyle} {...props('email')} />
            </FieldBox>
            <FieldBox id="f11-password" label="Password" error={errors.password} linked={fixed}>
              <input type="password" style={inputStyle} {...props('password')} />
            </FieldBox>
            <FieldBox id="f11-companySize" label="Company size" error={errors.companySize} linked={fixed}>
              <select style={inputStyle} {...props('companySize')}>
                <option value="" disabled>
                  Choose…
                </option>
                <option value="10">1–10</option>
                <option value="50">11–50</option>
                <option value="250">51–250</option>
              </select>
            </FieldBox>
            <FieldBox id="f11-vat" label="VAT number (optional)" error={errors.vat} linked={fixed}>
              <input style={inputStyle} {...props('vat')} />
            </FieldBox>
            <Row>
              <Button type="submit" tone="primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create account'}
              </Button>
            </Row>
          </Stack>
        </form>
      </Browser>
      <Row gap={8}>
        <Stat label="form renders" value={renders.current} />
        <Stat label="accounts created" value={accounts} tone={accounts > 1 ? 'bad' : 'neutral'} />
      </Row>
      <Code>
        {fixed
          ? `<input name="email" defaultValue="" onBlur={validateField}\n  aria-invalid={!!errors.email} aria-describedby="email-error" />\n{errors.email && <p id="email-error" role="alert">…</p>}\nif (busy.current) return; // submit guard`
          : `onChange={(e) => {\n  const next = { ...form, [e.target.name]: e.target.value };\n  setForm(next);\n  setErrors(validate(next)); // every field, every keystroke\n}}`}
      </Code>
      <Console title="Network + database" lines={c.lines} height={120} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <SignupForm fixed={false} />;
}

export function Solution() {
  return <SignupForm fixed />;
}
