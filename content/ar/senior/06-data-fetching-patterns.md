# أنماط جلب البيانات الفعالة (Efficient Data Fetching Patterns)

**Level:** Senior
**Merged from (original phrasings):**
- ما هي الاستراتيجيات التي تستخدمها لتنفيذ أنماط فعالة لجلب البيانات؟

## The concept (short answer)

عادةً ما لا تكمن التكلفة الكبرى لجلب البيانات في حجم البيانات (payload size)، بل في **تتالي طلبات الذهاب والإياب عبر الشبكة (round trips in series)**. صندوق الأدوات المعماري لدي:

- **القضاء على شلالات الطلبات (Kill request waterfalls):** يؤدي نمط "الجلب عند التصيير" (fetch-on-render) - حيث يجلب كل مكون بياناته داخل `useEffect` بعد تصيير المكون الأب - إلى إنشاء سلسلة بطيئة من الطلبات المتتابعة. قم ببدء الطلبات المستقلة **بالتوازي** (`Promise.all`، والاستعلامات المتوازية parallel queries) وفي **أبكر وقت ممكن** (محمل المسار route loader، أو Server Component، أو معالج الحدث) - وفق نمط "التصيير أثناء الجلب" (render-as-you-fetch).
- **الجلب على الخادم كلما أمكن ذلك:** تقوم React Server Components ومحملات المسارات بجلب البيانات بالقرب من قاعدة البيانات بزمن انتقال منخفض للغاية، وتُرسل كود HTML جاهزاً، ولا تُرسل أي كود لجلب البيانات إلى متصفح العميل. غلف الأجزاء البطيئة بحدود `<Suspense>` لتدفقها تدريجياً.
- **الجلب المسبق للبيانات المتوقعة (Prefetch likely next data):** عند التحويم فوق الرابط بالفأرة أو دخوله مجال الرؤية (`next/link` يُنفذ ذلك للمسارات تلقائياً)، أو استخدام `queryClient.prefetchQuery` عند التحويم فوق صف في جدول.
- **استراتيجية Stale-while-revalidate:** اعرض البيانات المخزنة مؤقتاً في الكاش فوراً، ثم حدّثها في الخلفية (عبر `staleTime` في TanStack Query/SWR، أو ترويسة HTTP `stale-while-revalidate`).
- **منع تكرار الطلبات (Deduplicate):** إذا طلب خمسة مكونات بيانات المستخدم الحالي في نفس اللحظة، يجب أن يُرسل طلب شبكة واحد فقط (كاش الاستعلامات المعتمد على المفاتيح من جانب العميل؛ أو `React.cache` و memoization لـ `fetch` داخل تصيير الخادم في Next.js).
- **تقليل البيانات المجلوبة:** الاعتماد على cursor pagination والاستعلامات اللانهائية (infinite queries)، وتحديد الحقول المطلوبة فقط (field selection)، واستخدام نقاط نهاية مجمعة (BFF) بدلاً من مشكلة N+1 في استدعاءات الشبكة، وإلغاء الطلبات القديمة بواسطة `AbortController` عند انتقال المستخدم.

## Real-life example: the problem

صفحة مشروع في تطبيق لإدارة المشاريع. على شبكة الواي فاي السريعة بالمكتب تُحمّل الصفحة خلال 700ms؛ أما لفريق المبيعات على واي فاي الفندق (~300ms RTT)، فتعرض الصفحة ثلاثة مؤشرات تحميل متتالية وتستغرق أكثر من 3 ثوانٍ. تُظهر لوحة الشبكة (Network panel) شلالاً تدريجياً: جلب المشروع -> جلب المهام -> جلب المسؤولين -> جلب النشاط، حيث لا يبدأ كل طلب إلا بعد انتهاء تصيير المكون السابق له.

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

ثلاث رحلات شبكة متتالية بالإضافة إلى N من طلبات المستخدم المتوازية، مع غياب كامل للتخزين المؤقت (الرجوع للصفحة يُعيد جلب كل شيء من الصفر)، وبدون إلغاء للطلبات (التنقل السريع قد يُحدّث الـ state ببيانات مشروع سابق).

## How to fix it

قم بالجلب على الخادم، بالتوازي، مع دمج البيانات المرتبطة معاً، وتدفق الجزء البطيء غير الحرج عبر Suspense.

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

بالنسبة للأجزاء التفاعلية من جانب العميل (كقائمة مهام لانهائية في تطبيق SPA)، استخدم كاش استعلامات مع الجلب المسبق:

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

لماذا ينجح هذا الحل: يُدفع ثمن زمن انتقال الشبكة مرة واحدة فقط (بالتوازي) بالقرب من مصدر البيانات في الخادم، وتتحول مشكلة N+1 إلى عملية join واحدة في قاعدة البيانات، ولم يعد تدفق النشاط البطيء يعطل الرسم الأول للصفحة، وتكون الزيارات المتكررة فورية من الكاش مع التحديث الهادئ في الخلفية. البدائل: توفر محملات المسارات (route loaders في React Router / Remix) خاصية "الجلب قبل التصيير" المماثلة في تطبيقات SPA؛ بينما تُعالج GraphQL مشاكل جلب بيانات زائدة أو ناقصة عبر تحديد الحقول مع اشتراط استخدام DataLoader لتجنب معضلة N+1 على الخادم.

## How to say it in the interview

- "أول ما أتحقق منه هو الشلال (Waterfall) في لوحة Network: نمط الجلب عند التصيير يربط طلبات الشبكة في سلاسل معطلة. أقوم برفع عمليات الجلب إلى المسار أو إلى Server Component، وتشغيل الطلبات المستقلة بالتوازي، وتدفق البيانات غير الحرجة خلف حدود Suspense."
- "من جانب العميل أستخدم كاش استعلامات (query cache) لمنع التكرار، ودعم stale-while-revalidate، وإلغاء الطلبات السابقة والجلب المسبق عند التحويم؛ واستخدام cursor pagination للقوائم الطويلة."
- فخ المقابلة: استخدام `await a(); await b();` المتتالية داخل Server Component لا يزال يُشكل شلالاً متتالياً - بل أطلق الوعود معاً أولاً ثم اجمعها بـ `Promise.all`. سؤال متابعة: الطلبات المترابطة (التي تحتاج `userId` قبل جلب `orders`) - انقل عملية الدمج (join) إلى الخادم أو اجمعها داخل نقطة نهاية واحدة بنمط BFF.
- المفاضلة (Trade-off): الجلب المسبق المفرط يستهلك باقات البيانات وسعة الخوادم خصوصاً على الهواتف؛ لذا اعتمد الجلب المسبق بناءً على نية المستخدم الصريحة (التحويم/التركيز) وليس على كل رابط ظاهر، واضبط `staleTime` بحسب طبيعة كل نوع بيانات.
