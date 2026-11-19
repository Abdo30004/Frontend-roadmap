# المقارنة بين Server Actions ومسارات الـ API (Route Handlers) لعمليات التعديل (Mutations)

**Level:** Senior
**Merged from (original phrasings):**
- متى يجب أن تستخدم عملية التعديل Server Action بدلاً من مسار API route؟

## The concept (short answer)

- **الـ Server Action (`"use server"`):** هي دالة غير متزامنة (async function) يستدعيها العميل تماماً كأي دالة محلية عادية؛ ويُحولها Next.js إلى نقطة نهاية `POST` بمعرف مبهم. هي الخيار المثالي **لعمليات التعديل المنطلقة من واجهة التطبيق لديك**: مثل النماذج (`<form action={...}>` التي تعمل حتى بدون تفعيل JavaScript - وفق مبدأ Progressive enhancement)، وخطاف `useActionState` لحالات التحميل والأخطاء، والتكامل التلقائي مع كاش Next.js (`revalidatePath`، و `revalidateTag`، و `redirect`) مما يُمكّن الواجهة المحدثة من العودة في نفس رحلة الشبكة. تمتاز بتطابق الأنواع من الطرف للطرف (End-to-end typed) دون كود وسيط.
- **مسارات الـ Route Handler / API (`app/api/.../route.ts`):** هي نقاط نهاية HTTP قياسية بروابط ثابتة ومحددة تتحكم بها. استخدمها عندما يكون المستهلك **جهة خارج واجهة Next.js الخاصة بك**: مثل تطبيقات الهواتف، والأنظمة الخارجية، وواجهات الـ API العامة ذات الإصدارات، و**الـ Webhooks** (مثل Stripe و GitHub التي تتطلب قراءة الجسم الخام raw body للتحقق من التوقيع الرقمي مع رموز استجابة دقيقة)، ونقاط نهاية `GET` القابلة للتخزين المؤقت، وتحميل الملفات المتدفق (streaming)، وسياسات الـ CORS.‏
- **ليست مخصصة لقراءة البيانات:** دوال Actions تعمل عبر بروتوكول `POST`، وغير قابلة للتخزين في الكاش، ويُرسلها العميل طلباً تلو الآخر - لذا اجلب البيانات في Server Components أو Route Handlers بدلاً منها.
- **الحقيقة الأمنية الصادمة:** الـ Server Action هي **نقطة نهاية HTTP عامة ومكشوفة بالكامل**. يمكن لأي شخص استدعاؤها بأي وسائط برمجية، بغض النظر عما إذا كان الزر ظاهراً في شاشته أم لا. إخفاء الزر في الواجهة ليس حماية أمنية (Security through obscurity). يجب على كل Action أن **تتحقق من المصادقة (Authentication)، وتتحقق من الصلاحيات والملكية (Authorization)، وتتحقق من صحة المدخلات (Validation)** - تماماً كأي مسار API عام. يُوفر Next.js حماية من هجمات CSRF (فحص Origin) ومعرفات غير قابلة للتخمين، لكنه لا يتولى عنك فحص الصلاحيات.

## Real-life example: the problem

حالة كلاسيكية شائعة: أداة إدارة مشاريع SaaS متعددة المستأجرين (Multi-tenant). زر "حذف المشروع" لا يظهر في الواجهة إلا لمالك المشروع فقط. يفتح مستخدم من شركة أخرى أدوات المطور (DevTools)، وينسخ طلب الـ Action الخاص بحذف مشروعه، ويبدل قيمة `projectId` بمعرف مشروع رآه في رابط مشاركة سابق، ويُعيد إرسال الطلب (Replay) - فيتم حذف مشروع شركة أخرى لا يملكه! وثقت الـ Action في واجهة المستخدم لتنفيذ فحص الصلاحية (ثغرة أمنية فادحة من نوع IDOR). وهناك مشكلة ثانية: حاول الفريق إتاحة نفس الـ Action لتطبيق الهاتف المحمول، ففشل التطبيق لأن معرفات الـ Action IDs تتغير تلقائياً مع كل عملية بناء جديدة على الخادم.

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

عامل الـ Server Action كنقطة نهاية أمنية كاملة: تحقق من الجلسة، واقصر استعلام الحذف على ملكية المستخدم، وتحقق من صحة البيانات بـ Zod، ثم أعد التحقق من الكاش. واستخدم Route Handler للمستهلكين الخارجيين.

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

لماذا ينجح هذا الحل: تتحقق الـ Action من هوية المستخدم في كل طلب وتقصر الحذف على `ownerId` في استعلام قاعدة البيانات، فلا يمكن لأي طلب متلاعب به أن يمس مشروعاً يخص مستخدماً آخر. وترفض مكتبة Zod المدخلات المشوهة. وتمنح `useActionState` واجهة استخدام تدعم حالات التحميل والخطأ وتعمل حتى قبل اكتمال الترطيب. ويعيش منطق العمل في موديول مشترك، لتصبح الـ Server Action والـ Route Handler مجرد واجهات خفيفة تطبق نفس القواعد.

## How to say it in the interview

- "أستخدم Server Actions لعمليات التعديل المنطلقة من واجهة Next.js - كنماذج الإدخال، والترقية التدريجية (Progressive enhancement)، وإعادة التحقق من الكاش في نفس رحلة الشبكة. وأستخدم Route Handlers لكل ما له مستهلك خارجي: تطبيقات الهواتف، والـ Webhooks، ونقاط النهاية العامة ذات الإصدارات، وطلبات GET القابلة للتخزين المؤقت."
- "الـ Server Action هي نقطة نهاية HTTP عامة تعمل بـ POST. أقوم بالمصادقة والتحقق من الصلاحيات تجاه المورد والتحقق من صحة المدخلات داخل كل Action - فرؤية الزر في الواجهة لا تعني الأمان بأي حال."
- فخ المقابلة: الثقة في وسائط الدالة لأن "كودي هو من مررها" - فالقيم المربوطة عبر `.bind(null, id)` تمر عبر المتصفح ويمكن التلاعب بها، لذا يجب معاملة كل وسيط كمدخل غير موثوق. سؤال متابعة: لماذا لا نستخدم Actions لجلب البيانات - لأنها تستخدم POST، ولا تُخزن في الكاش، وتعمل على التوالي.
- المفاضلة (Trade-off): تربط الـ Actions التعديل بتطبيق Next.js وبنائه الحالي (تتغير المعرفات مع كل نشر)؛ بينما تتطلب Route Handlers كتابة كود وسيط أكثر لكنها توفر عقداً ثابتاً، وتحكماً كاملاً برموز الحالة والكاش.
