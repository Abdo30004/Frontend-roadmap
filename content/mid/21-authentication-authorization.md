# How do you handle authentication and authorization in frontend apps?

**Level:** Mid
**Merged from (original phrasings):**
- How do you handle authentication and authorization in frontend apps?

## The concept (short answer)
- **Authentication** answers "who are you?" (login, session, tokens). **Authorization** answers "what are you allowed to do?" (roles, permissions, ownership).
- **The real security boundary is the server.** Frontend route guards and hidden buttons are UX only. Anyone can call your API with curl or edit JS state in DevTools, so every API endpoint must check the session and the permission itself.
- **Token storage:**
  - `localStorage`/`sessionStorage`: readable by any JS on the page, so one XSS bug or a compromised npm or analytics script steals the token.
  - **httpOnly + Secure + SameSite cookie**: JS cannot read it and the browser attaches it automatically. This is the preferred approach, ideally with a BFF that holds the real access and refresh tokens server-side. You still need CSRF protection (SameSite=Lax/Strict, a CSRF token for unsafe methods).
  - If you must use bearer tokens in an SPA: keep the access token **in memory**, short-lived (5-15 min), with the **refresh token in an httpOnly cookie** and rotated on each use.
- **Refresh flow:** on a 401, refresh once, queue other requests that fail while the refresh is in flight, then retry them. If the refresh fails, log out.
- **Route guards:** check the session before rendering protected pages (Next.js middleware or a server-side check in the layout or page; in an SPA, a guard component) to avoid flashing protected content, and redirect to login with a `returnTo` parameter.
- **UI-level authorization:** the server sends the user's permissions and the UI hides or disables actions based on them, for better UX only.

## Real-life example: the problem
In a B2B invoicing SaaS, a security audit found two issues. (1) The JWT was stored in `localStorage` and the app loads a third-party chat widget, so any script on the page could read the token and act as the user for 30 days (the token never expired). (2) The "Delete invoice" button was hidden for non-admins, but the API did not check the role. A viewer-role user who opened DevTools and replayed the `DELETE /invoices/:id` request deleted invoices of the whole company.

```jsx
// login
const { token } = await api.post('/login', creds);
localStorage.setItem('token', token);              // readable by any script on the page

// api client
axios.defaults.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;

// UI-only "authorization"
function InvoiceActions({ invoice, user }) {
  return user.role === 'admin' ? <button onClick={() => api.delete(`/invoices/${invoice.id}`)}>Delete</button> : null;
}
```

```js
// API: authenticates but never authorizes
app.delete('/invoices/:id', requireLogin, async (req, res) => {
  await db.invoices.delete(req.params.id);          // any logged-in user, any company's invoice
  res.sendStatus(204);
});
```

## How to fix it
**Server: session in an httpOnly cookie, and authorization on every endpoint.**
```js
app.post('/login', async (req, res) => {
  const user = await verifyCredentials(req.body);
  const sessionId = await sessions.create(user.id, { ttl: '8h' });
  res.cookie('sid', sessionId, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  res.json({ id: user.id, name: user.name, permissions: user.permissions }); // no token in body
});

app.delete('/invoices/:id', requireSession, async (req, res) => {
  const invoice = await db.invoices.find(req.params.id);
  if (!invoice || invoice.companyId !== req.user.companyId) return res.sendStatus(404); // tenant check
  if (!req.user.permissions.includes('invoice:delete')) return res.sendStatus(403);    // permission check
  await db.invoices.delete(invoice.id);
  res.sendStatus(204);
});
```

**Next.js: guard routes before rendering, and gate UI on permissions.**
```js
// middleware.js (renamed proxy.js in Next 16): fast redirect for missing session (optimistic check only)
import { NextResponse } from 'next/server';
export function middleware(req) {
  if (!req.cookies.get('sid')) {
    const url = new URL('/login', req.url);
    url.searchParams.set('returnTo', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
}
export const config = { matcher: ['/app/:path*'] };
```

```jsx
// app/app/layout.jsx: real session validation on the server
import { getCurrentUser } from '@/server/auth';
import { redirect } from 'next/navigation';

export default async function AppLayout({ children }) {
  const user = await getCurrentUser();        // validates sid against the session store
  if (!user) redirect('/login');
  return <PermissionsProvider value={user.permissions}>{children}</PermissionsProvider>;
}

// UI-level authorization: convenience only, the API enforces it anyway
function Can({ permission, children }) {
  const permissions = usePermissions();
  return permissions.includes(permission) ? children : null;
}
// <Can permission="invoice:delete"><DeleteButton id={invoice.id} /></Can>
```

Why it works: the session ID cannot be read by injected scripts (httpOnly), is only sent over HTTPS (Secure), and is not sent on cross-site POSTs (SameSite=Lax). The API checks both tenant and permission, so replayed or crafted requests fail. The guard in the server layout means protected HTML is never sent to anonymous users, and the UI hides actions the user cannot perform.

Alternatives: OAuth/OIDC with an identity provider (Auth0, Keycloak, Entra ID) using Authorization Code + PKCE, ideally through a BFF; libraries such as Auth.js/NextAuth that handle the cookie session for you.

## How to say it in the interview
- "Frontend auth is about UX: guards, hiding buttons, redirects. Security is enforced on the server for every request: authenticate the session, then authorize the specific action on the specific resource."
- "I prefer httpOnly, Secure, SameSite cookies over localStorage, because an XSS bug or a malicious third-party script can't steal what JS can't read. Cookies then need CSRF protection."
- Follow-up: "How do you refresh tokens?" Use a short-lived access token and a rotating refresh token in an httpOnly cookie, with a single in-flight refresh shared by concurrent 401s.
- Trade-off: server sessions are easy to revoke but need a session store. Stateless JWTs scale easily but are hard to revoke before they expire, so keep them short-lived.
