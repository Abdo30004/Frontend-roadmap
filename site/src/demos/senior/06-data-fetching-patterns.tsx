import { useEffect, useRef, useState } from 'react';
import { Badge, Browser, Button, Code, Note, Panel, Row, Stack, Stat, fakeRequest } from '../../demo-kit';

export const scenario =
  'A project-management app opened on hotel Wi-Fi (~300ms per round trip): the project page shows the project, its tasks with assignees, and activity.';
export const task = 'Open "Apollo", look at the timeline and total time, then open "Zephyr" and go back to "Apollo".';
export const solutionNote =
  'Same page: parallel requests (tasks joined with assignees), prefetch on hover/focus, and a stale-while-revalidate cache.';

const RTT: [number, number] = [260, 340];
const PROJECTS: Record<string, { name: string; tasks: { id: string; title: string; who: string }[]; activity: string }> = {
  apollo: {
    name: 'Apollo launch',
    tasks: [
      { id: 't1', title: 'Pricing page', who: 'Mia' },
      { id: 't2', title: 'Release notes', who: 'Omar' },
      { id: 't3', title: 'QA pass', who: 'Lena' },
    ],
    activity: 'Omar closed 2 tasks · 5 min ago',
  },
  zephyr: {
    name: 'Zephyr mobile',
    tasks: [
      { id: 't4', title: 'Push opt-in', who: 'Ken' },
      { id: 't5', title: 'Crash fixes', who: 'Mia' },
    ],
    activity: 'Ken commented · 1 h ago',
  },
};

interface Bar {
  label: string;
  start: number;
  end?: number;
  bg?: boolean;
}
type Track = <T>(label: string, fn: () => Promise<T>, bg?: boolean) => Promise<T>;
interface PageData {
  name: string;
  tasks: { id: string; title: string; who: string }[];
}

const api = {
  project: (id: string) => fakeRequest(() => ({ name: PROJECTS[id].name }), { delay: RTT }),
  tasks: (id: string) =>
    fakeRequest(() => PROJECTS[id].tasks.map(({ id: tid, title, who }) => ({ id: tid, title, userId: who })), { delay: RTT }),
  user: (uid: string) => fakeRequest(() => ({ name: uid }), { delay: RTT }),
  tasksWithAssignees: (id: string) => fakeRequest(() => PROJECTS[id].tasks, { delay: RTT }), // one SQL join on the server
  activity: (id: string) => fakeRequest(() => PROJECTS[id].activity, { delay: RTT }),
};

const Spinner = ({ what }: { what: string }) => <Badge tone="info">loading {what}…</Badge>;

/* ---------- BUG: each component fetches in its own useEffect, after its parent rendered ---------- */
function useFetch<T>(track: Track, label: string, fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let on = true;
    void track(label, fn).then((d) => on && setData(d));
    return () => {
      on = false;
    };
  }, [label]); // eslint-disable-line react-hooks/exhaustive-deps
  return data;
}
function WaterfallPage({ id, track, done }: { id: string; track: Track; done: () => void }) {
  const project = useFetch(track, `GET /projects/${id}`, () => api.project(id));
  if (!project) return <Spinner what="project" />;
  return (
    <Stack gap={6}>
      <strong>{project.name}</strong>
      <TaskList id={id} track={track} done={done} />
    </Stack>
  );
}
function TaskList({ id, track, done }: { id: string; track: Track; done: () => void }) {
  const tasks = useFetch(track, `GET /projects/${id}/tasks`, () => api.tasks(id));
  if (!tasks) return <Spinner what="tasks" />;
  return (
    <>
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} track={track} />
      ))}
      <Activity id={id} track={track} done={done} />
    </>
  );
}
function TaskRow({ task, track }: { task: { title: string; userId: string }; track: Track }) {
  const user = useFetch(track, `GET /users/${task.userId}`, () => api.user(task.userId)); // N+1
  return (
    <span style={{ fontSize: 13 }}>
      • {task.title} · {user?.name ?? '…'}
    </span>
  );
}
function Activity({ id, track, done }: { id: string; track: Track; done: () => void }) {
  const a = useFetch(track, `GET /projects/${id}/activity`, () => api.activity(id));
  useEffect(() => {
    if (a) done();
  }, [a]); // eslint-disable-line react-hooks/exhaustive-deps
  return a ? <Note>{a}</Note> : <Spinner what="activity" />;
}

/* ---------- FIX: parallel loader + SWR cache + prefetch ---------- */
function useProjectLoader(track: Track) {
  const cache = useRef(new Map<string, { page?: PageData; activity?: string; pending?: Promise<void> }>());
  const load = (id: string, bg = false) => {
    const entry = cache.current.get(id) ?? {};
    cache.current.set(id, entry);
    entry.pending ??= Promise.all([
      track(
        `GET /projects/${id} + tasks (parallel)`,
        async () => {
          const [p, tasks] = await Promise.all([api.project(id), api.tasksWithAssignees(id)]);
          entry.page = { name: p.name, tasks };
        },
        bg,
      ),
      track(
        `GET /projects/${id}/activity`,
        async () => {
          entry.activity = await api.activity(id);
        },
        bg,
      ),
    ]).then(() => {
      entry.pending = undefined;
    });
    return entry;
  };
  return { cache: cache.current, load };
}
function FastPage({ id, loader, done }: { id: string; loader: ReturnType<typeof useProjectLoader>; done: () => void }) {
  const [, rerender] = useState(0);
  useEffect(() => {
    let on = true;
    const cached = loader.cache.get(id);
    const hadData = !!cached?.page && !cached.pending;
    if (hadData) done(); // stale data shown instantly…
    const entry = loader.load(id, hadData); // …while revalidating in the background
    void entry.pending?.then(() => {
      if (on) {
        rerender((n) => n + 1);
        if (!hadData) done();
      }
    });
    return () => {
      on = false;
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const e = loader.cache.get(id);
  if (!e?.page) return <Spinner what="project" />;
  return (
    <Stack gap={6}>
      <strong>{e.page.name}</strong>
      {e.page.tasks.map((t) => (
        <span key={t.id} style={{ fontSize: 13 }}>
          • {t.title} · {t.who}
        </span>
      ))}
      {e.activity ? <Note>{e.activity}</Note> : <Spinner what="activity" />}
    </Stack>
  );
}

function ProjectApp({ fixed }: { fixed: boolean }) {
  const [nav, setNav] = useState<{ id: string; n: number; t0: number } | null>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const t0 = useRef(0); // timeline origin
  const clickAt = useRef(0); // for "time to full page"
  const prefetched = useRef<string | null>(null);
  const track: Track = async (label, fn, bg) => {
    const start = performance.now() - t0.current;
    setBars((b) => [...b, { label, start, bg }]);
    const out = await fn();
    const end = performance.now() - t0.current;
    setBars((b) => b.map((x) => (x.label === label && x.end === undefined ? { ...x, end } : x)));
    return out;
  };
  const loader = useProjectLoader(track);

  const open = (id: string) => {
    clickAt.current = performance.now();
    if (prefetched.current !== id) {
      t0.current = clickAt.current;
      setBars([]);
    } // keep the prefetch bars
    prefetched.current = null;
    setTotal(null);
    setNav((n) => ({ id, n: (n?.n ?? 0) + 1, t0: t0.current }));
  };
  const prefetch = (id: string) => {
    if (!fixed || loader.cache.get(id)?.page || loader.cache.get(id)?.pending) return;
    t0.current = performance.now();
    setBars([]);
    prefetched.current = id;
    loader.load(id);
  };
  const done = () => setTotal(performance.now() - clickAt.current);

  const scale = Math.max(1400, ...bars.map((b) => b.end ?? 0));
  return (
    <Stack gap={12}>
      <Browser url={`pm.example.com/projects/${nav?.id ?? ''}`}>
        <Row gap={12} align="flex-start">
          <Stack gap={4}>
            {Object.keys(PROJECTS).map((id) => (
              <Button
                key={id}
                tone={nav?.id === id ? 'primary' : 'default'}
                onClick={() => open(id)}
                onMouseEnter={() => prefetch(id)}
                onFocus={() => prefetch(id)}
              >
                {PROJECTS[id].name}
              </Button>
            ))}
          </Stack>
          <div style={{ flex: '1 1 160px', minHeight: 90 }}>
            {!nav ? (
              <Note>Pick a project.</Note>
            ) : fixed ? (
              <FastPage key={nav.n} id={nav.id} loader={loader} done={done} />
            ) : (
              <WaterfallPage key={nav.n} id={nav.id} track={track} done={done} />
            )}
          </div>
        </Row>
      </Browser>

      <Row gap={8}>
        <Stat
          label="time to full page"
          value={total === null ? '—' : `${Math.round(total)} ms`}
          tone={total === null ? 'neutral' : total > 600 ? 'bad' : 'good'}
        />
        <Stat label="requests" value={bars.length} />
      </Row>

      <Panel title="Network timeline">
        {bars.length === 0 ? (
          <Note>No requests yet.</Note>
        ) : (
          <Stack gap={4}>
            {bars.map((b, i) => (
              <div key={i} style={{ fontSize: 11 }}>
                <div style={{ color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.label}
                  {b.bg ? ' · background revalidate' : ''}
                </div>
                <div style={{ position: 'relative', height: 8, background: 'var(--paper-2)', borderRadius: 4 }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      borderRadius: 4,
                      left: `${(b.start / scale) * 100}%`,
                      width: `${(((b.end ?? scale) - b.start) / scale) * 100}%`,
                      background: b.end === undefined ? 'var(--info-soft)' : b.bg ? 'var(--ink-3)' : 'var(--info)',
                    }}
                  />
                </div>
              </div>
            ))}
          </Stack>
        )}
      </Panel>

      <Code>
        {fixed
          ? `const [project, tasks] = await Promise.all([\n  getProject(id), getTasksWithAssignees(id)]); // one round trip\n<Link onMouseEnter={() => prefetch(id)} />\ncache hit → render now, revalidate in background`
          : `useEffect(() => fetch(\`/projects/\${id}\`), [id]);\nif (!project) return <Spinner/>;   // children wait\n// TaskList fetches tasks, each TaskRow fetches its user (N+1)`}
      </Code>
    </Stack>
  );
}

export function Problem() {
  return <ProjectApp fixed={false} />;
}

export function Solution() {
  return <ProjectApp fixed />;
}
