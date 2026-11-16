# Server Actions vs API Routes (Route Handlers) for Mutations

**Level:** Senior
**Merged from (original phrasings):**
- When should a mutation use a Server Action instead of an API route?

## The concept (short answer)

- **Server Action (`"use server"`):** an async function the client calls like a normal function; Next.js turns it into a `POST` endpoint with an opaque ID. Best for **mutations triggered by your own UI**: forms (`<form action={...}>` works without JS - progressive enhancement), `useActionState` for pending/error state, and built-in integration with the cache (`revalidatePath`, `revalidateTag`, `redirect`) so the updated UI comes back in the same round trip. End-to-end typed, no fetch boilerplate.
- **Route Handler / API route (`app/api/.../route.ts`):** a regular HTTP endpoint with a stable URL you control. Use it when the consumer is **not your Next.js UI**: mobile apps, third parties, public/versioned APIs, **webhooks** (Stripe, GitHub - need raw body for signature verification, specific status codes), cacheable `GET` endpoints, streaming/file downloads, CORS.
- **Not for reads:** actions are `POST`, not cached, and the client dispatches them one at a time - fetch data in Server Components or route handlers instead.
- **Security reality:** a Server Action is a **public HTTP endpoint**. Anyone can call it with any arguments, regardless of whether the button is rendered for them. Hiding UI is not authorization. Every action must **authenticate, authorize (ownership/role), and validate input** - exactly like an API route. Next.js adds CSRF protection (Origin check) and unguessable IDs, but not access control.

## Real-life example: the problem

A typical case: a multi-tenant SaaS project tool. The "Delete project" button is only rendered for project owners. A user from another company opens DevTools, copies the action request from their own project's delete, swaps the `projectId` for one they saw in a shared link, replays it - and deletes a project they do not own. The action trusted the UI to do authorization (an IDOR vulnerability). A second issue: the team also exposed the same logic as a Server Action for their mobile app, which cannot call it reliably because action IDs change between builds.

```tsx
// app/projects/[id]/actions.ts
'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

export async function deleteProject(projectId: string) {
  // No session check, no ownership check, no input validation
  await db.project.delete({ where: { id: projectId } });
  revalidatePath('/projects');
}

// app/projects/[id]/page.tsx
export default async function ProjectPage({ params }) {
  const { id } = await params;
  const session = await auth();
  const project = await db.project.findUnique({ where: { id } });
  return (
    <>
      <h1>{project.name}</h1>
      {project.ownerId === session.user.id && (               // "security" only in the UI
        <form action={deleteProject.bind(null, id)}><button>Delete project</button></form>
      )}
    </>
  );
}
```

## How to fix it

Treat the action as an endpoint: auth, authorization scoped in the query, validation, then revalidate. Use a Route Handler for external consumers.

```tsx
// app/projects/[id]/actions.ts
'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const Input = z.object({ projectId: z.string().uuid() });

export async function deleteProject(prevState: { error?: string }, formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: 'Not signed in' };

  const parsed = Input.safeParse({ projectId: formData.get('projectId') });
  if (!parsed.success) return { error: 'Invalid request' };

  // Authorization in the data query itself: only deletes if the caller owns it
  const { count } = await db.project.deleteMany({
    where: { id: parsed.data.projectId, ownerId: session.user.id },
  });
  if (count === 0) return { error: 'Project not found' };   // same answer for "not yours" and "missing"

  revalidatePath('/projects');
  redirect('/projects');
}

// app/projects/[id]/DeleteProjectForm.tsx
'use client';
import { useActionState } from 'react';
import { deleteProject } from './actions';

export function DeleteProjectForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(deleteProject, {});
  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <button disabled={pending}>{pending ? 'Deleting...' : 'Delete project'}</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
```

```ts
// app/api/v1/projects/[id]/route.ts - stable, versioned endpoint for the mobile app
import { deleteProjectForUser } from '@/lib/projects';     // shared, already-authorized domain logic
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateBearer(req.headers.get('authorization'));
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const ok = await deleteProjectForUser(user.id, id);
  return ok ? new Response(null, { status: 204 }) : Response.json({ error: 'not_found' }, { status: 404 });
}

// app/api/webhooks/stripe/route.ts - must be a route: raw body + signature
export async function POST(req: Request) {
  const raw = await req.text();
  const event = stripe.webhooks.constructEvent(raw, req.headers.get('stripe-signature')!, process.env.STRIPE_WEBHOOK_SECRET!);
  await handleStripeEvent(event);                          // make it idempotent: Stripe retries
  return new Response(null, { status: 200 });
}
```

Why it works: the action re-checks who is calling on every request and scopes the delete by `ownerId`, so a replayed request for someone else's project changes nothing. Zod rejects malformed input. `useActionState` gives pending/error UI and the form still works before hydration. Domain logic lives in a shared module, so the Server Action (for our UI) and the Route Handler (for mobile and webhooks) are thin adapters with the same rules. Centralizing checks in a data-access layer (or a `next-safe-action`-style wrapper) prevents forgetting them in the next action.

## How to say it in the interview

- "Server Actions for mutations from my own Next.js UI - forms, progressive enhancement, revalidation in one round trip. Route Handlers for anything with an external consumer: mobile, third parties, webhooks, cacheable GETs, public versioned APIs."
- "A Server Action is a public POST endpoint. I authenticate, authorize against the resource and validate input inside every action - UI visibility is not security."
- Trap: trusting arguments because "my code set them" - values bound with `.bind(null, id)` round-trip through the client unencrypted and can be swapped (Next encrypts closure variables of inline actions, but every argument is still untrusted input). Follow-up: why not use actions for data fetching - they are POST, uncached and run sequentially.
- Trade-off: actions couple the mutation to the Next.js app and its build (IDs change per deploy); route handlers are more boilerplate but give a stable contract, explicit status codes and caching control.
