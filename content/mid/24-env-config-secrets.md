# How do you manage environment configuration without exposing secrets in frontend bundles?

**Level:** Mid
**Merged from (original phrasings):**
- How do you manage environment configuration without exposing secrets in frontend bundles?

## The concept (short answer)
- **Rule:** anything shipped to the browser is public. Minification is not protection: anyone can open DevTools, the Sources tab, or the `.js` files and search for `sk_` or `key`.
- **How bundlers expose env vars:** at build time, references like `process.env.NEXT_PUBLIC_X` or `import.meta.env.VITE_X` are **replaced with literal strings** in the JS. Only prefixed variables are inlined (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_` in CRA). The prefix means **"make this public"**, not "make this configurable".
- **Public config** (OK in the bundle): API base URLs, feature flags, analytics IDs, Stripe *publishable* keys, Sentry DSN, Maps keys that are **restricted by HTTP referrer and API**.
- **Secrets** (never in the bundle): DB credentials, Stripe *secret* keys, OpenAI or other paid API keys, service tokens, signing secrets. They live only on the server (Route Handlers, Server Components, Server Actions, BFF, edge functions), and the browser calls **your** endpoint, which adds the key and enforces auth and rate limits.
- **Defense in depth:** the `server-only` package makes a module fail the build if it is imported into client code. Add secret scanning (gitleaks, GitHub secret scanning) in CI. Keep `.env*.local` in `.gitignore`. Store secrets in the hosting platform or a vault, not in Git.
- **Runtime config:** because public vars are baked in at build time, one Docker image can't be promoted from staging to prod with different values. Instead, serve config at runtime (a `/config.json` fetched at startup, or values read by a Server Component and passed down) so the same artifact works in every environment.

## Real-life example: the problem
A startup's "AI resume writer" app is a Vite SPA that calls an LLM provider directly from the browser. To make it work, the developer put the API key in `VITE_OPENAI_KEY`. Within days, someone found the key in the production bundle (`assets/index-3f9a.js`) and used it for their own workloads. The company got a five-figure invoice and had to rotate the key in a hurry, which broke the app. The same codebase also had `VITE_ADMIN_TOKEN` for an internal admin endpoint.

```bash
# .env (committed to Git, too)
VITE_OPENAI_KEY=sk-proj-abc123...
VITE_ADMIN_TOKEN=adm_9f8e7d...
VITE_API_URL=https://api.resumeai.example.com
```

```js
// src/lib/ai.js: runs in the browser
export async function improveResume(text) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_OPENAI_KEY}`, // inlined as a literal in the bundle
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: text }] }),
  });
  return res.json();
}
```

## How to fix it
Move the call behind your own server endpoint (Next.js Route Handler shown here; an Express or edge function in front of a Vite app works the same way):

```bash
# .env.local (gitignored), and set in the hosting platform's secret store for prod
OPENAI_API_KEY=sk-proj-...           # no prefix, so it is never inlined into client code
NEXT_PUBLIC_API_URL=https://api.resumeai.example.com   # public by design
```

```js
// lib/server/ai.js
import 'server-only';                // build error if a client component imports this

export async function callLLM(messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 800 }),
  });
  if (!res.ok) throw new Error(`LLM error ${res.status}`);
  return res.json();
}
```

```js
// app/api/improve-resume/route.js
import { callLLM } from '@/lib/server/ai';
import { getCurrentUser } from '@/server/auth';
import { rateLimit } from '@/server/rate-limit';

export async function POST(req) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  if (!(await rateLimit(`improve:${user.id}`, { max: 20, per: '1h' }))) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }
  const { text } = await req.json();
  if (typeof text !== 'string' || text.length > 10_000) return Response.json({ error: 'Invalid input' }, { status: 400 });

  const data = await callLLM([{ role: 'user', content: `Improve this resume:\n${text}` }]);
  return Response.json({ result: data.choices[0].message.content });
}
```

```js
// client: no secret, calls our own endpoint
const { result } = await fetch('/api/improve-resume', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
}).then(r => r.json());
```

Cleanup steps: **rotate** the leaked keys immediately (deleting them from the code is not enough, because they remain in Git history and old bundles on CDNs), remove the admin token from the client entirely, add `gitleaks` to CI, and add a check that fails the build if a `sk-` pattern appears in `dist/`.

Why it works: the secret only exists in the server environment, and unprefixed variables are never inlined into client bundles. The server endpoint also adds what a raw key can't: authentication, rate limiting, input validation and cost control.

## How to say it in the interview
- "`NEXT_PUBLIC_` and `VITE_` mean 'publish this into the JS'. Anything with those prefixes is public, so secrets never get a prefix and are only used server-side, through a proxy or BFF endpoint."
- "Some keys are designed to be public (Stripe publishable, Maps). For those, the protection is restrictions at the provider (referrer, API scope, quotas), not hiding them."
- Follow-up: "How do you deploy the same build to staging and prod?" Use runtime config: serve `/config.json` or read env on the server and pass it down, instead of baking values in at build time.
- Trap: a leaked secret must be **rotated**. Removing it from code doesn't help, because it stays in Git history, cached bundles and attacker logs.
