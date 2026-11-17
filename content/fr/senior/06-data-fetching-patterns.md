# Patterns efficaces de récupération de données

**Niveau :** Senior
**Merged from (original phrasings):**
- Quelles stratégies utilisez-vous pour mettre en place des patterns efficaces de récupération de données ?

## The concept (short answer)

Le coût principal de la récupération de données n'est généralement pas la taille des réponses, mais les **allers-retours en série**. Ma boîte à outils :

- **Éliminer les waterfalls de requêtes :** le « fetch-on-render » (chaque composant fait son fetch dans `useEffect` après le rendu de son parent) enchaîne les requêtes. Lancez les requêtes indépendantes **en parallèle** (`Promise.all`, requêtes parallèles) et le plus **tôt** possible (loader de route, Server Component, gestionnaire d'événement) - c'est le « render-as-you-fetch ».
- **Récupérer côté serveur quand c'est possible :** les React Server Components / loaders de route font le fetch à côté de la base de données avec une faible latence, envoient du HTML prêt à l'emploi et n'envoient aucun code de fetch au client. Enveloppez les parties lentes dans `<Suspense>` pour les streamer.
- **Précharger les données probables :** au survol d'un lien ou à son entrée dans le viewport (`next/link` le fait pour les routes), `queryClient.prefetchQuery` au survol d'une ligne.
- **Stale-while-revalidate :** affichez instantanément les données en cache, rafraîchissez en arrière-plan (`staleTime` de TanStack Query/SWR, `stale-while-revalidate` en HTTP).
- **Dédupliquer :** cinq composants qui demandent l'utilisateur courant doivent produire une seule requête (cache de requêtes par clé côté client ; `React.cache` / mémoïsation de `fetch` dans Next au sein d'un même rendu serveur).
- **Récupérer moins :** pagination par curseur / infinite queries, sélection de champs, endpoints d'agrégation (BFF) au lieu de N+1 appels, annulation avec `AbortController` quand l'utilisateur quitte la page.

## Real-life example: the problem

La page projet d'une application de gestion de projet. Sur le Wi-Fi du bureau, elle se charge en 700ms ; pour une équipe commerciale sur le Wi-Fi d'un hôtel (~300ms de RTT), la page affiche trois spinners à la suite et met plus de 3 secondes. Le panneau Network montre un escalier : projet -> tâches -> assignés -> activité, chaque requête ne démarrant qu'après le rendu du composant précédent.

```jsx
'use client';

function ProjectPage({ projectId }) {
  const [project, setProject] = useState(null);
  useEffect(() => {
    fetch(`/api/projects/${projectId}`).then((r) => r.json()).then(setProject);
  }, [projectId]);
  if (!project) return <Spinner />;                      // les enfants ne peuvent pas encore lancer leur fetch
  return (
    <>
      <h1>{project.name}</h1>
      <TaskList projectId={projectId} />
    </>
  );
}

function TaskList({ projectId }) {
  const [tasks, setTasks] = useState(null);
  useEffect(() => {
    fetch(`/api/projects/${projectId}/tasks`).then((r) => r.json()).then(setTasks);
  }, [projectId]);
  if (!tasks) return <Spinner />;
  return tasks.map((t) => <TaskRow key={t.id} task={t} />);
}

function TaskRow({ task }) {
  const [assignee, setAssignee] = useState(null);
  useEffect(() => {                                       // N+1 : une requête par ligne
    fetch(`/api/users/${task.assigneeId}`).then((r) => r.json()).then(setAssignee);
  }, [task.assigneeId]);
  return <li>{task.title} - {assignee?.name ?? '...'}</li>;
}
```

Trois allers-retours séquentiels plus N requêtes utilisateur en parallèle, aucun cache (revenir sur la page refait tous les fetchs), aucune annulation (une navigation rapide peut mettre à jour le state avec les données d'un ancien projet).

## How to fix it

Récupérez les données côté serveur, en parallèle, avec les jointures déjà faites, et streamez la partie lente et non critique.

```tsx
// app/projects/[id]/page.tsx (Server Component)
import { Suspense } from 'react';
import { getProject, getTasksWithAssignees, getActivity } from '@/lib/data';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Lance les deux immédiatement ; on les attend ensemble -> une seule latence, pas deux
  const [project, tasks] = await Promise.all([getProject(id), getTasksWithAssignees(id)]);
  const activityPromise = getActivity(id);                // service lent, non attendu

  return (
    <>
      <h1>{project.name}</h1>
      <ul>{tasks.map((t) => <li key={t.id}>{t.title} - {t.assignee.name}</li>)}</ul>
      <Suspense fallback={<ActivitySkeleton />}>
        <ActivityFeed activityPromise={activityPromise} />   {/* arrive en streaming quand c'est prêt */}
      </Suspense>
    </>
  );
}

// lib/data.ts
import 'server-only';
import { cache } from 'react';
export const getProject = cache(async (id: string) => db.project.findUniqueOrThrow({ where: { id } }));
// une jointure SQL au lieu de N+1 appels HTTP ; cache() déduplique si le layout et la page l'appellent tous les deux
export const getTasksWithAssignees = cache(async (id: string) =>
  db.task.findMany({ where: { projectId: id }, include: { assignee: { select: { name: true } } } })
);
```

Pour les parties interactives côté client (une liste de tâches infinie dans une SPA), utilisez un cache de requêtes avec préchargement :

```jsx
function useTasks(projectId) {
  return useInfiniteQuery({
    queryKey: ['tasks', projectId],
    queryFn: ({ pageParam, signal }) =>
      fetch(`/api/projects/${projectId}/tasks?cursor=${pageParam ?? ''}`, { signal }).then((r) => r.json()),
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60_000,                                   // stale-while-revalidate après 1 min
  });
}

function ProjectLink({ project }) {
  const qc = useQueryClient();
  const prefetch = () => qc.prefetchQuery({ queryKey: ['project', project.id], queryFn: () => fetchProject(project.id), staleTime: 60_000 });
  return <Link href={`/projects/${project.id}`} onMouseEnter={prefetch} onFocus={prefetch}>{project.name}</Link>;
}
```

Pourquoi ça marche : la latence est payée une seule fois (en parallèle) et près des données (côté serveur), le N+1 devient une jointure, le flux lent ne bloque plus le premier affichage, et les visites suivantes sont instantanées grâce au cache, avec revalidation en arrière-plan. Alternatives : les `loader`s de route (React Router / Remix) offrent la même propriété « fetch avant le rendu » dans une SPA ; GraphQL résout l'over-fetching et l'under-fetching par la sélection de champs, mais nécessite DataLoader pour éviter le N+1 côté serveur.

## How to say it in the interview

- « Mon premier réflexe est de regarder le waterfall dans le panneau Network : le fetch-on-render enchaîne les allers-retours. Je remonte les fetchs au niveau de la route ou d'un Server Component, j'exécute en parallèle ceux qui sont indépendants et je streame les données non critiques derrière Suspense. »
- « Côté client, j'utilise un cache de requêtes pour la déduplication, le stale-while-revalidate, l'annulation et le préchargement au survol ; la pagination par curseur pour les longues listes. »
- Piège : `await a(); await b();` dans un Server Component reste un waterfall - lancez d'abord les promises, puis `Promise.all`. Question de suivi : les requêtes dépendantes (il faut `userId` avant `orders`) - déplacez la jointure côté serveur ou dans un seul endpoint BFF.
- Compromis : un préchargement agressif gaspille de la bande passante et de la capacité serveur sur mobile ; préchargez sur intention (survol / focus) plutôt que pour chaque lien visible, et ajustez `staleTime` par type de données.
