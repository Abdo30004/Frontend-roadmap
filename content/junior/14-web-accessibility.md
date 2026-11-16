# What is web accessibility (a11y) and how do you implement WCAG?

**Level:** Junior
**Merged from (original phrasings):**
- What is Web Accessibility (a11y)?
- What are web accessibility standards (WCAG) and how do you implement them?

## The concept (short answer)
- Accessibility means people with disabilities (blind/low-vision, deaf, motor, cognitive) can perceive, operate and understand your app, often through assistive tech like screen readers, keyboard-only navigation, voice control or zoom.
- **WCAG** (Web Content Accessibility Guidelines, current version 2.2) is the standard. It is organized around **POUR**: Perceivable, Operable, Understandable, Robust. Level **AA** is the usual legal/contract target (ADA in the US, the European Accessibility Act in the EU).
- The biggest wins come from **semantic HTML**: `<button>`, `<a href>`, `<label>`, `<nav>`, `<main>`, headings in order. Native elements give you keyboard support, focus and screen-reader roles for free.
- Key checks: text alternatives (`alt`), color contrast (4.5:1 for normal text), visible focus, everything usable with the keyboard, form labels and error messages announced, no information conveyed by color alone.
- **ARIA** fills gaps (e.g. `aria-live`, `aria-expanded`), but the first rule of ARIA is: do not use ARIA if a native element does the job. Bad ARIA is worse than none.
- Test with automated tools (axe DevTools, Lighthouse, eslint-plugin-jsx-a11y) plus manual keyboard and screen reader testing; automation only catches roughly a third of issues.

## Real-life example: the problem
A typical case: a bank's "Transfer money" form passes design review but a blind customer using a screen reader, and a customer who navigates by keyboard because of a motor impairment, both cannot complete a transfer.
- The submit "button" is a `div`, so Tab skips it and Enter does nothing.
- Inputs have only placeholders, so the screen reader says "edit text, blank".
- The error appears as red text that is never announced.
- The design removed focus outlines because they "looked ugly".

```jsx
function TransferForm({ onSubmit }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="form">
      <input placeholder="Amount" value={amount}
             onChange={(e) => setAmount(e.target.value)} />
      <input placeholder="IBAN" />
      {error && <span style={{ color: "red" }}>{error}</span>}
      <div className="btn" onClick={() => {
        if (!amount) setError("Required");
        else onSubmit(amount);
      }}>
        <img src="/icons/send.svg" />
      </div>
    </div>
  );
}
```

```css
*:focus { outline: none; }
.form input::placeholder { color: #c8c8c8; } /* about 1.6:1 contrast */
```

## How to fix it
```jsx
import { useId, useState } from "react";

function TransferForm({ onSubmit }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const amountId = useId();
  const errorId = useId();

  function handleSubmit(e) {
    e.preventDefault();                       // native form: Enter key works
    if (!amount) {
      setError("Enter an amount to transfer.");
      return;
    }
    setError("");
    onSubmit(amount);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2>Transfer money</h2>

      <label htmlFor={amountId}>Amount (EUR)</label>
      <input
        id={amountId}
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      <p id={errorId} role="alert">{error}</p>

      <label htmlFor="iban">Recipient IBAN</label>
      <input id="iban" name="iban" autoComplete="off" />

      <button type="submit">
        <img src="/icons/send.svg" alt="" /> Send transfer
      </button>
    </form>
  );
}
```

```css
/* Keep focus visible, but only for keyboard users */
:focus-visible {
  outline: 3px solid #1a5fb4;
  outline-offset: 2px;
}
.error { color: #b00020; } /* 4.5:1+ on white, plus an icon/text, not color alone */
```

Why it works:
- `<form>` + `<button type="submit">` gives Tab focus, Enter/Space activation and correct "button" role with no extra code.
- `<label htmlFor>` makes the screen reader announce "Amount (EUR), edit text", and clicking the label focuses the input.
- `role="alert"` announces the error as soon as it appears; `aria-describedby` re-reads it when the field is focused; `aria-invalid` marks the field.
- The decorative icon has `alt=""` so it is skipped; the button has visible text as its accessible name.
- `:focus-visible` keeps a clear focus ring for keyboard users without showing it on mouse click.

Alternative: for complex widgets (modals, comboboxes, tabs) use a tested headless library such as Radix UI or React Aria instead of hand-rolling focus traps and ARIA.

## How to say it in the interview
- "Accessibility is making the app usable by everyone, including keyboard and screen-reader users. I target WCAG 2.2 AA and start with semantic HTML, because native elements give keyboard and screen-reader support for free."
- Name concrete checks: labels, alt text, 4.5:1 contrast, visible focus, keyboard-only flow, announced errors, and testing with axe/Lighthouse plus a real screen reader (VoiceOver or NVDA).
- Trap: "I add `role="button"` to a div." Follow-up: then you also need `tabIndex={0}` and Enter/Space handlers, which is exactly why you should use `<button>`.
- Trade-off: custom-styled widgets look nicer but cost a lot of ARIA and focus work; accessible component libraries save time and legal risk.
