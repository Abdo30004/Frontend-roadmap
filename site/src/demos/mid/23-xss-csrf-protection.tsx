import { useEffect, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Console, Note, Panel, Row, Stack, Stat, useConsole } from '../../demo-kit';

export const scenario = 'A recipe community lets users post reviews with simple formatting (bold, italics). Members stay logged in with a session cookie.';
export const task = 'Post the pre-filled review and watch the attacker panel. Then click "Visit evil-site.example" and watch the account balance.';
export const solutionNote = 'Same page: reviews go through an allow-list sanitizer, and the cookie is SameSite=Lax + every POST needs a CSRF token.';

// Harmless payload: the "stolen cookie" is a fake value sent to a panel on this page via a DOM event.
const PAYLOAD = `Tasty! <b>5 stars</b> <img src="data:," onerror="this.dispatchEvent(new CustomEvent('steal',{bubbles:true,detail:'session=abc123'}))">`;
const ALLOWED = new Set(['B', 'I', 'EM', 'STRONG', 'P', 'BR', 'UL', 'OL', 'LI']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE']);

// A tiny allow-list sanitizer: parse in an inert document (nothing loads or runs there),
// then rebuild only allowed tags, with NO attributes at all.
function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = doc.createElement('div');
  const copy = (from: Node, to: Node) => {
    from.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) to.appendChild(doc.createTextNode(n.textContent ?? ''));
      else if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as Element;
        if (ALLOWED.has(el.tagName)) {
          const clean = doc.createElement(el.tagName.toLowerCase());
          copy(el, clean);
          to.appendChild(clean);
        } else if (!DROP.has(el.tagName)) copy(el, to); // unknown tag: keep its text, drop the tag
      }
    });
  };
  copy(doc.body, out);
  return out.innerHTML;
}

function RecipePage({ fixed }: { fixed: boolean }) {
  const [draft, setDraft] = useState(PAYLOAD);
  const [reviews, setReviews] = useState<{ id: number; html: string }[]>([{ id: 0, html: 'Perfect weeknight dinner, <i>add more garlic</i>.' }]);
  const [stolen, setStolen] = useState<string[]>([]);
  const [balance, setBalance] = useState(2400);
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const c = useConsole();

  // The "attacker server": receives whatever the injected script sends.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onSteal = (e: Event) => {
      const detail = String((e as CustomEvent).detail);
      setStolen((s) => [...s, detail].slice(-5));
      c.log(`injected script ran → sent "${detail}" to evil.example`, 'bad');
    };
    el.addEventListener('steal', onSteal);
    return () => el.removeEventListener('steal', onSteal);
  }, [c.log]);

  const post = () => {
    const html = fixed ? sanitize(draft) : draft;
    setReviews((r) => [...r, { id: nextId.current++, html }]);
    c.log(fixed ? `review saved, sanitized to: ${html}` : 'review saved as raw HTML', fixed ? 'good' : 'warn');
  };

  const visitEvil = () => {
    c.log('evil-site.example: <form action="https://recipes.example/api/transfer" method="POST"> auto-submits', 'info');
    if (!fixed) {
      c.log('browser: sid cookie has no SameSite → attached to the cross-site POST', 'warn');
      c.log('server: valid session, no CSRF check → transfer €500 to attacker', 'bad');
      setBalance((b) => Math.max(0, b - 500));
    } else {
      c.log('browser: sid is SameSite=Lax → NOT sent on a cross-site POST', 'good');
      c.log('server: no session and no X-CSRF-Token header → 403 Forbidden', 'good');
    }
  };

  return (
    <Stack gap={14}>
      <Browser url="recipes.example/r/garlic-butter-pasta">
        <Stack gap={10}>
          <strong>Garlic butter pasta · reviews</strong>
          <div ref={listRef}>
            <Stack gap={6}>
              {reviews.map((r) => (
                <div key={r.id} style={{ fontSize: 14, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 8, overflowWrap: 'anywhere' }}
                  dangerouslySetInnerHTML={{ __html: r.html }} />
              ))}
            </Stack>
          </div>
          <textarea className="dk-input" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Your review" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
          <Row><Button tone="primary" onClick={post}>Post review</Button><Note>Logged in as Ana · balance €{balance.toLocaleString('en-US')}</Note></Row>
        </Stack>
      </Browser>
      <Row gap={10} align="stretch">
        <Panel title="Attacker panel (evil.example)" tone={stolen.length ? 'bad' : undefined} style={{ flex: '1 1 200px', minWidth: 0 }}>
          {stolen.length ? stolen.map((s, i) => <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>cookie stolen: {s}</div>) : <Note>Waiting for victims…</Note>}
        </Panel>
        <Panel title="CSRF" style={{ flex: '1 1 200px', minWidth: 0 }}>
          <Stack gap={6}>
            <Note>Ana opens another site while still logged in.</Note>
            <Row><Button onClick={visitEvil}>Visit evil-site.example</Button></Row>
            <Badge tone="neutral">Set-Cookie: sid=…; HttpOnly{fixed ? '; SameSite=Lax' : ''}</Badge>
          </Stack>
        </Panel>
      </Row>
      <Row gap={8}>
        <Stat label="cookies stolen" value={stolen.length} tone={stolen.length ? 'bad' : 'neutral'} />
        <Stat label="Ana's balance" value={`€${balance.toLocaleString('en-US')}`} tone={balance < 2400 ? 'bad' : 'good'} />
      </Row>
      <Code>{fixed
        ? `<div dangerouslySetInnerHTML={{ __html: sanitize(review.html) }} />  // allow-list, no attributes
res.cookie('sid', id, { httpOnly: true, secure: true, sameSite: 'lax' });
if (req.get('X-CSRF-Token') !== req.session.csrfToken) return res.sendStatus(403);`
        : `<div dangerouslySetInnerHTML={{ __html: review.html }} />  // raw user HTML
res.cookie('sid', id, { httpOnly: true });          // no SameSite, no CSRF token`}</Code>
      <Console lines={c.lines} height={130} onClear={c.clear} />
    </Stack>
  );
}

export function Problem() {
  return <RecipePage fixed={false} />;
}

export function Solution() {
  return <RecipePage fixed />;
}
