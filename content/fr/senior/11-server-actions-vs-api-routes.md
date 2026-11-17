# Server Actions vs API routes (Route Handlers) pour les mutations

**Niveau :** Senior
**Merged from (original phrasings):**
- Quand une mutation doit-elle utiliser une Server Action plutôt qu'une API route ?

## The concept (short answer)

- **Server Action (`"use server"`) :** une fonction async que le client appelle comme une fonction normale ; Next.js la transforme en endpoint `POST` avec un identifiant opaque. Idéale pour les **mutations déclenchées par votre propre UI** : formulaires (`<form action={...}>` fonctionne sans JS - amélioration progressive), `useActionState` pour l'état d'attente / d'erreur, et intégration native avec le cache (`revalidatePath`, `revalidateTag`, `redirect`), de sorte que l'UI mise à jour revient dans le même aller-retour. Typée de bout en bout, sans code répétitif autour de fetch.
- **Route Handler / API route (`app/api/.../route.ts`) :** un endpoint HTTP classique avec une URL stable que vous maîtrisez. Utilisez-le quand le consommateur **n'est pas votre UI Next.js** : applications mobiles, tiers, API publiques / versionnées, **webhooks** (Stripe, GitHub - besoin du body brut pour vérifier la signature, de codes de statut précis), endpoints `GET` cachables, streaming / téléchargements de fichiers, CORS.
- **Pas pour les lectures :** les actions sont des `POST`, non mises en cache, et le client les exécute une par une - récupérez plutôt les données dans des Server Components ou des route handlers.
- **La réalité côté sécurité :** une Server Action est un **endpoint HTTP public**. N'importe qui peut l'appeler avec n'importe quels arguments, que le bouton lui soit affiché ou non. Masquer l'UI n'est pas une autorisation. Chaque action doit **authentifier, autoriser (propriété / rôle) et valider les entrées** - exactement comme une API route. Next.js ajoute une protection CSRF (vérification de l'Origin) et des identifiants impossibles à deviner, mais pas de contrôle d'accès.

## Real-life example: the problem

Un cas typique : un outil SaaS multi-tenant de gestion de projets. Le bouton « Supprimer le projet » n'est affiché qu'aux propriétaires du projet. Un utilisateur d'une autre entreprise ouvre les DevTools, copie la requête de l'action de suppression de son propre projet, remplace le `projectId` par celui qu'il a vu dans un lien partagé, la rejoue - et supprime un projet qui ne lui appartient pas. L'action comptait sur l'UI pour l'autorisation (une vulnérabilité IDOR). Deuxième problème : l'équipe a aussi exposé la même logique sous forme de Server Action pour son application mobile, qui ne peut pas l'appeler de manière fiable car les identifiants d'action changent d'un build à l'autre.

```tsx
// app/projects/[id]/actions.ts
'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

export async function deleteProject(projectId: string) {
  // Aucune vérification de session, de propriété, ni validation des entrées
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
      {project.ownerId === session.user.id && (               // « sécurité » uniquement dans l'UI
        <form action={deleteProject.bind(null, id)}><button>Delete project</button></form>
      )}
    </>
  );
}
```

## How to fix it

Traitez l'action comme un endpoint : authentification, autorisation intégrée à la requête, validation, puis revalidation. Utilisez un Route Handler pour les consommateurs externes.

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

  // Autorisation dans la requête de données elle-même : ne supprime que si l'appelant en est propriétaire
  const { count } = await db.project.deleteMany({
    where: { id: parsed.data.projectId, ownerId: session.user.id },
  });
  if (count === 0) return { error: 'Project not found' };   // même réponse pour « pas à vous » et « inexistant »

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
// app/api/v1/projects/[id]/route.ts - endpoint stable et versionné pour l'application mobile
import { deleteProjectForUser } from '@/lib/projects';     // logique métier partagée, autorisation déjà incluse
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateBearer(req.headers.get('authorization'));
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const ok = await deleteProjectForUser(user.id, id);
  return ok ? new Response(null, { status: 204 }) : Response.json({ error: 'not_found' }, { status: 404 });
}

// app/api/webhooks/stripe/route.ts - doit être une route : body brut + signature
export async function POST(req: Request) {
  const raw = await req.text();
  const event = stripe.webhooks.constructEvent(raw, req.headers.get('stripe-signature')!, process.env.STRIPE_WEBHOOK_SECRET!);
  await handleStripeEvent(event);                          // à rendre idempotent : Stripe refait ses envois
  return new Response(null, { status: 200 });
}
```

Pourquoi ça marche : l'action revérifie l'identité de l'appelant à chaque requête et limite la suppression par `ownerId`, donc une requête rejouée sur le projet de quelqu'un d'autre ne change rien. Zod rejette les entrées mal formées. `useActionState` fournit l'UI d'attente / d'erreur, et le formulaire fonctionne même avant l'hydratation. La logique métier vit dans un module partagé, si bien que la Server Action (pour notre UI) et le Route Handler (pour le mobile et les webhooks) sont de simples adaptateurs appliquant les mêmes règles. Centraliser les vérifications dans une couche d'accès aux données (ou un wrapper du type `next-safe-action`) évite de les oublier dans la prochaine action.

## How to say it in the interview

- « Des Server Actions pour les mutations issues de ma propre UI Next.js - formulaires, amélioration progressive, revalidation en un seul aller-retour. Des Route Handlers pour tout ce qui a un consommateur externe : mobile, tiers, webhooks, GET cachables, API publiques versionnées. »
- « Une Server Action est un endpoint POST public. J'authentifie, j'autorise par rapport à la ressource et je valide les entrées dans chaque action - la visibilité dans l'UI n'est pas de la sécurité. »
- Piège : faire confiance aux arguments parce que « c'est mon code qui les a définis » - les valeurs liées avec `.bind(null, id)` font l'aller-retour via le client sans chiffrement et peuvent être remplacées (Next chiffre les variables de closure des actions inline, mais chaque argument reste une entrée non fiable). Question de suivi : pourquoi ne pas utiliser les actions pour récupérer des données - ce sont des POST, non mis en cache et exécutés séquentiellement.
- Compromis : les actions couplent la mutation à l'application Next.js et à son build (les identifiants changent à chaque déploiement) ; les route handlers demandent plus de code répétitif mais offrent un contrat stable, des codes de statut explicites et le contrôle du cache.
