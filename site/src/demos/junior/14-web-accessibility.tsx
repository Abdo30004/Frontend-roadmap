import { useEffect, useId, useRef, useState, type FocusEvent, type FormEvent } from 'react';
import { Browser, Code, Console, Note, Row, Stack, Stat, useConsole } from '../../demo-kit';

export const scenario =
  'A bank\'s "Transfer money" form. A customer who cannot use a mouse navigates it with the keyboard and a screen reader.';
export const task =
  'Click into "Amount", then use only Tab, Shift+Tab and Enter: send an empty transfer, then send 50. Read the screen-reader log.';
export const solutionNote = 'Same form, but a real <form>, <label>s, a <button> with text, an announced error and a visible focus ring.';

const CSS = `
.a11y14 input { font: 14px var(--font-body); padding: 8px 10px; border-radius: 8px; border: 2px solid var(--line-2); background: var(--surface); color: var(--ink); width: 100%; max-width: 260px; box-sizing: border-box; }
.a11y14 label { display: block; font-size: 13px; color: var(--ink-2); margin: 8px 0 4px; }
.a11y14-bad *:focus { outline: none; }
.a11y14-bad input::placeholder { color: var(--line-2); }
.a11y14 input[data-error='true'] { border-color: var(--bad); }
.a11y14-good :focus-visible { outline: 3px solid var(--info); outline-offset: 2px; }
.a11y14 .send { margin-top: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 8px; border: none; background: var(--accent); color: var(--paper); font: 600 14px var(--font-body); cursor: pointer; }
.a11y14 .err { margin: 6px 0 0; font-size: 13px; color: var(--bad); }
`;

/** Visible text, skipping aria-hidden parts (like a screen reader does). */
function nameOf(el: Element): string {
  return Array.from(el.childNodes)
    .map((n) => (n instanceof Element ? (n.getAttribute('aria-hidden') === 'true' ? '' : nameOf(n)) : (n.textContent ?? '')))
    .join('')
    .trim();
}

/** A tiny screen-reader model: reads the role + accessible name of the focused element. */
function announce(el: Element): string {
  if (el instanceof HTMLInputElement) {
    const name = el.labels?.[0]?.textContent?.trim() || el.getAttribute('aria-label') || '';
    const invalid = el.getAttribute('aria-invalid') === 'true' ? ', invalid entry' : '';
    const desc = el.getAttribute('aria-describedby');
    const extra = desc ? `, ${document.getElementById(desc)?.textContent ?? ''}` : '';
    return `${name || '(no name)'}, edit text${invalid}${el.value ? `, ${el.value}` : ', blank'}${extra}`;
  }
  if (el instanceof HTMLButtonElement) return `${nameOf(el) || '(no name)'}, button`;
  return `${el.tagName.toLowerCase()}`;
}

function TransferForm({ fixed }: { fixed: boolean }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(0);
  const amountId = useId();
  const errorId = useId();
  const ibanId = useId();
  const sr = useConsole();
  const wrap = useRef<HTMLDivElement>(null);

  // Screen readers speak content that appears inside role="alert" / aria-live regions.
  useEffect(() => {
    const root = wrap.current;
    if (!root) return;
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        const node = r.target instanceof Element ? r.target : r.target.parentElement;
        const live = node?.closest('[role="alert"],[aria-live]');
        const text = live?.textContent?.trim();
        if (live && text) sr.log(`🔊 alert: "${text}"`, 'info');
      }
    });
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [sr.log]);

  const onFocus = (e: FocusEvent<HTMLDivElement>) => sr.log(`🔊 ${announce(e.target)}`);
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget;
    if (!next || !wrap.current?.contains(next)) sr.log('⇥ focus left the transfer form', 'warn');
  };

  const submit = () => {
    if (!amount) {
      setError(fixed ? 'Enter an amount to transfer.' : 'Required');
      return;
    }
    setError('');
    setSent((s) => s + 1);
    setAmount('');
  };

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  return (
    <Stack gap={14}>
      <style>{CSS}</style>
      <Browser url="bank.example/transfers/new">
        <div ref={wrap} onFocus={onFocus} onBlur={onBlur} className={`a11y14 ${fixed ? 'a11y14-good' : 'a11y14-bad'}`}>
          {fixed ? (
            <form onSubmit={onFormSubmit} noValidate>
              <h3 style={{ margin: '0 0 4px' }}>Transfer money</h3>
              <label htmlFor={amountId}>Amount (EUR)</label>
              <input
                id={amountId}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                data-error={Boolean(error)}
              />
              <p id={errorId} role="alert" className="err">
                {error && `⚠ ${error}`}
              </p>
              <label htmlFor={ibanId}>Recipient IBAN</label>
              <input id={ibanId} autoComplete="off" defaultValue="" />
              <div>
                <button type="submit" className="send">
                  <span aria-hidden>➤</span> Send transfer
                </button>
              </div>
            </form>
          ) : (
            <div>
              <h3 style={{ margin: '0 0 8px' }}>Transfer money</h3>
              <input placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} data-error={Boolean(error)} />
              <div style={{ height: 8 }} />
              <input placeholder="IBAN" />
              {/* error only shown as a red border */}
              <div>
                <div className="send" onClick={submit}>
                  <span>➤</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Browser>

      <Row gap={8}>
        <Stat label="transfers sent" value={sent} tone={sent > 0 ? 'good' : 'neutral'} />
        <Stat
          label="error visible"
          value={error ? (fixed ? 'text + icon' : 'red border') : '-'}
          tone={error ? (fixed ? 'good' : 'bad') : 'neutral'}
        />
      </Row>
      <Console title="Screen reader (simulated from the real DOM)" lines={sr.lines} height={150} onClear={sr.clear} />
      {!fixed && <Note>Mouse users can click the arrow and it works. Try it with the keyboard only.</Note>}
      <Code>
        {fixed
          ? `<form onSubmit={handleSubmit}>\n  <label htmlFor={amountId}>Amount (EUR)</label>\n  <input id={amountId} aria-invalid={!!error} aria-describedby={errorId} />\n  <p id={errorId} role="alert">{error}</p>\n  <button type="submit">Send transfer</button>\n</form>`
          : `<input placeholder="Amount" />\n<input placeholder="IBAN" />\n<div className="btn" onClick={submit}><img src="send.svg" /></div>\n/* css */ *:focus { outline: none; }`}
      </Code>
    </Stack>
  );
}

export function Problem() {
  return <TransferForm fixed={false} />;
}

export function Solution() {
  return <TransferForm fixed />;
}
