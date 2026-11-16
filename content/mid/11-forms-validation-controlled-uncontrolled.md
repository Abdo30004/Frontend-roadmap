# How do you handle forms and validation in React? Controlled vs. uncontrolled components

**Level:** Mid
**Merged from (original phrasings):**
- How do you handle forms and validation in React?
- Controlled vs. uncontrolled components: when should you use each?

## The concept (short answer)
- **Controlled**: React state is the source of truth (`value` + `onChange`). Every keystroke updates state and re-renders. Good for instant UI reactions: live formatting (card numbers), dependent fields, enabling a button, search-as-you-type.
- **Uncontrolled**: the DOM keeps the value (`defaultValue`, read via `ref` or `FormData` on submit). No re-render per keystroke. Good for simple or large forms, file inputs (`<input type="file">` is always uncontrolled), and React 19 form Actions.
- Validation layers: native HTML (`required`, `type="email"`, `pattern`) for free basics, a **schema** (zod/yup) for real rules, and **server-side validation always**, because client checks can be bypassed.
- Good UX: validate on blur or on submit (not on the first keystroke), show errors next to the field, connect them with `aria-invalid` and `aria-describedby`, focus the first invalid field, disable double submit, show server errors.
- Real-world answer: **react-hook-form** (uncontrolled inputs registered by ref, so few re-renders) + **zod** (one schema for types and rules, reusable on the server).
- Common bug: switching an input from uncontrolled to controlled (`value={undefined}` then a string). React warns about it; initialize with `''`.

## Real-life example: the problem
A B2B SaaS signup form with 15 fields (company, VAT number, address, password, etc.) is fully controlled with one `useState` object and hand-written validation. Users report that typing is laggy on older laptops, error messages appear while they are still typing their email, the "Company size" select sends the string `"50"` instead of a number, and the backend gets invalid VAT numbers because the check only exists in one `if`.

```jsx
function SignupForm() {
  const [form, setForm] = useState({ email: '', password: '', companySize: '', vat: '' /* ...11 more */ });
  const [errors, setErrors] = useState({});

  const onChange = (e) => {
    const next = { ...form, [e.target.name]: e.target.value };
    setForm(next);                 // whole 15-field form re-renders on each keystroke
    setErrors(validate(next));     // errors shown while the user is still typing
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    await fetch('/api/signup', { method: 'POST', body: JSON.stringify(form) }); // no check, no double-submit guard
  };

  return (
    <form onSubmit={onSubmit}>
      <input name="email" value={form.email} onChange={onChange} />
      {errors.email && <span>{errors.email}</span>}            {/* not linked to the input */}
      <select name="companySize" value={form.companySize} onChange={onChange}>...</select>
      {/* ...13 more fields */}
      <button>Create account</button>
    </form>
  );
}

function validate(f) {
  const e = {};
  if (!f.email.includes('@')) e.email = 'Invalid email';
  if (f.password.length < 8) e.password = 'Too short';
  return e; // VAT, company size... forgotten
}
```

## How to fix it
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// One schema: rules + TypeScript type. Import the same schema in the API route.
export const signupSchema = z.object({
  email: z.string().email('Enter a valid work email'),
  password: z.string().min(12, 'At least 12 characters'),
  companySize: z.coerce.number().int().min(1, 'Select a company size'),
  vat: z.string().regex(/^[A-Z]{2}[0-9A-Z]{8,12}$/, 'Invalid VAT number').optional().or(z.literal('')),
});
type SignupInput = z.infer<typeof signupSchema>;

export function SignupForm() {
  const {
    register, handleSubmit, setError, setFocus,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema), mode: 'onTouched' });

  const onSubmit = async (data: SignupInput) => {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.status === 409) {
      setError('email', { message: 'An account with this email already exists' });
      setFocus('email');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <label htmlFor="email">Work email</label>
      <input id="email" type="email" {...register('email')}
             aria-invalid={!!errors.email} aria-describedby="email-error" />
      {errors.email && <p id="email-error" role="alert">{errors.email.message}</p>}

      <label htmlFor="companySize">Company size</label>
      <select id="companySize" {...register('companySize')} defaultValue="">
        <option value="" disabled>Choose...</option>
        <option value="10">1-10</option>
        <option value="50">11-50</option>
      </select>
      {errors.companySize && <p role="alert">{errors.companySize.message}</p>}

      {/* password, vat... same pattern */}
      <button disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create account'}</button>
    </form>
  );
}
```
Why it works: react-hook-form registers **uncontrolled** inputs by ref, so typing does not re-render the whole form. `mode: 'onTouched'` shows errors after the user leaves a field, not on the first keystroke. The zod schema validates everything in one place, converts `companySize` to a number, gives a typed `data` object, and the same schema runs on the server. Errors are accessible, server errors map back to fields, and `isSubmitting` prevents double submits. It also focuses the first invalid field on submit by default.

Alternatives: for a small form, an uncontrolled `<form action={action}>` with React 19 `useActionState` (or a Next.js Server Action) and `FormData` works without a library. Use a controlled input only for the fields that need live behavior (e.g. formatting a card number), which react-hook-form supports via `Controller`.

## How to say it in the interview
- "Controlled means React state owns the value: great for live reactions, but it re-renders on every keystroke. Uncontrolled means the DOM owns it and I read it on submit: simpler and faster for big forms."
- "In production I use react-hook-form with a zod schema, and I validate the same schema again on the server, because client validation is only for UX."
- Trap: "client-side validation is enough". It is not; anyone can send a request with curl.
- Trade-off: controlled gives more control and simpler mental model for small forms; uncontrolled scales better but makes "react to every change" logic slightly harder (`watch` in react-hook-form re-renders when used).
