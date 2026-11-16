# Efficient Data Fetching Patterns

**Level:** Senior
**Merged from (original phrasings):**
- What strategies do you use for implementing efficient data fetching patterns?

## The concept (short answer)

The biggest data-fetching cost is usually not payload size but **round trips in series**. My toolbox:

- **Kill request waterfalls:** "fetch-on-render" (each component fetches in `useEffect` after its parent rendered) chains requests. Start independent requests **in parallel** (`Promise.all`, parallel queries) and as **early** as possible (route loader, Server Component, event handler) - "render-as-you-fetch".
- **Fetch on the server when possible:** React Server Components / route loaders fetch next to the database with low latency, send ready HTML, and ship no fetching code to the client. Wrap slow parts in `<Suspense>` to stream them.
- **Prefetch likely next data:** on link hover/viewport (`next/link` does it for routes), `queryClient.prefetchQuery` on hover of a row.
- **Stale-while-revalidate:** show cached data instantly, refresh in the background (TanStack Query/SWR `staleTime`, HTTP `stale-while-revalidate`).
- **Deduplicate:** five components asking for the current user must produce one request (query cache by key on the client; `React.cache` / Next's `fetch` memoization within one server render).
- **Fetch less:** cursor pagination / infinite queries, field selection, aggregate endpoints (BFF) instead of N+1 calls, cancellation with `AbortController` when the user navigates away.

## Real-life example: the problem

A project-management app's project page. On office Wi-Fi it loads in 700ms; for a sales team on hotel Wi-Fi (~300ms RTT) the page shows three spinners in a row and takes 3+ seconds. The Network panel shows a staircase: project -> tasks -> assignees -> activity, each starting only after the previous component rendered.

```jsx
'use client';

function ProjectPage({ projectId }) {
  const [project, setProject] = useState(null);
  useEffect(() => {
    fetch(`/api/projects/${projectId}`).then((r) => r.json()).then(setProject);
  }, [projectId]);
  if (!project) return <Spinner />;                      // children cannot start fetching yet
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
  useEffect(() => {                                       // N+1: one request per row
    fetch(`/api/users/${task.assigneeId}`).then((r) => r.json()).then(setAssignee);
  }, [task.assigneeId]);
  return <li>{task.title} - {assignee?.name ?? '...'}</li>;
}
```

Three sequential round trips plus N parallel user requests, no caching (coming back to the page refetches everything), no cancellation (fast navigation can set state from an old project).

## How to fix it

Fetch on the server, in parallel, with the joined data, and stream the slow non-critical part.

```tsx
// app/projects/[id]/page.tsx (Server Component)
import { Suspense } from 'react';
import { getProject, getTasksWithAssignees, getActivity } from '@/lib/data';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Start both immediately; await together -> one round of latency, not two
  const [project, tasks] = await Promise.all([getProject(id), getTasksWithAssignees(id)]);
  const activityPromise = getActivity(id);                // slow service, not awaited

  return (
    <>
      <h1>{project.name}</h1>
      <ul>{tasks.map((t) => <li key={t.id}>{t.title} - {t.assignee.name}</li>)}</ul>
      <Suspense fallback={<ActivitySkeleton />}>
        <ActivityFeed activityPromise={activityPromise} />   {/* streams in when ready */}
      </Suspense>
    </>
  );
}

// lib/data.ts
import 'server-only';
import { cache } from 'react';
export const getProject = cache(async (id: string) => db.project.findUniqueOrThrow({ where: { id } }));
// one SQL join instead of N+1 HTTP calls; cache() dedups if layout + page both call it
export const getTasksWithAssignees = cache(async (id: string) =>
  db.task.findMany({ where: { projectId: id }, include: { assignee: { select: { name: true } } } })
);
```

For client-side interactive parts (an infinite task list in a SPA), use a query cache with prefetching:

```jsx
function useTasks(projectId) {
  return useInfiniteQuery({
    queryKey: ['tasks', projectId],
    queryFn: ({ pageParam, signal }) =>
      fetch(`/api/projects/${projectId}/tasks?cursor=${pageParam ?? ''}`, { signal }).then((r) => r.json()),
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60_000,                                   // stale-while-revalidate after 1 min
  });
}

function ProjectLink({ project }) {
  const qc = useQueryClient();
  const prefetch = () => qc.prefetchQuery({ queryKey: ['project', project.id], queryFn: () => fetchProject(project.id), staleTime: 60_000 });
  return <Link href={`/projects/${project.id}`} onMouseEnter={prefetch} onFocus={prefetch}>{project.name}</Link>;
}
```

Why it works: latency is paid once (parallel) and close to the data (server), the N+1 becomes a join, the slow feed no longer blocks first paint, and repeat visits are instant from cache while revalidating in the background. Alternatives: route `loader`s (React Router / Remix) give the same "fetch before render" property in a SPA; GraphQL solves over/under-fetching with field selection but needs DataLoader to avoid server-side N+1.

## How to say it in the interview

- "My first check is the waterfall in the Network panel: fetch-on-render chains round trips. I hoist fetches to the route or a Server Component, run independent ones in parallel, and stream non-critical data behind Suspense."
- "On the client I use a query cache for dedup, stale-while-revalidate, cancellation and prefetching on hover; cursor pagination for long lists."
- Trap: `await a(); await b();` in a Server Component is still a waterfall - start promises first, then `Promise.all`. Follow-up: dependent requests (need `userId` before `orders`) - move the join server-side or into one BFF endpoint.
- Trade-off: aggressive prefetching wastes bandwidth and server capacity on mobile; prefetch on intent (hover/focus) rather than on every visible link, and tune `staleTime` per data type.
