# ترحيل تطبيقات الواجهة الأمامية القديمة (Legacy Migration) إلى بنية تقنية حديثة

**Level:** Senior
**Merged from (original phrasings):**
- اشرح استراتيجيتك لترحيل تطبيقات الواجهة الأمامية القديمة (Legacy) إلى حزم تقنية حديثة.

## The concept (short answer)

- تجنب تماماً **إعادة الكتابة الشاملة المفاجئة (Big-bang rewrite)**: فهي تُجمد تطوير الميزات الجديدة أو تُكرر الجهد لشهور طويلة، ويستمر الهدف البرمجي في التغير، ويكشف يوم الإطلاق كافة الحالات الحدية المنسية دفعة واحدة.
- اعتمد **نمط خناق التين (Strangler-fig pattern)**: ضع طبقة توجيه وسيطة (Reverse Proxy، أو قواعد CDN، أو `rewrites` في Next.js) أمام كلا التطبيقين، وانقل **مساراً واحداً أو ميزة واحدة في كل مرة** إلى البنية الجديدة، مع توجيه كل ما لم يتم ترحيله بعد إلى التطبيق القديم. فينكمش التطبيق القديم تدريجياً حتى يمكن حذفه بأمان.
- حافظ على سلاسة التجربة للمستخدمين عبر الحدود المشتركة: **جلسة مصادقة مشتركة (Shared Auth/Session)** (كوكي موحد على نفس النطاق يفهمه كلا التطبيقين)، ومتغيرات تصميم موحدة لتبدو الصفحات متطابقة، ونظام تحليلات مشترك.
- أثبت التكافؤ التام عبر **اختبارات تطابق الميزات (Feature-parity tests)**: تشغيل نفس اختبارات Playwright على المسار القديم والمسار الجديد قبل تحويل حركة الزوار؛ ونشر كل مسار خلف علم ميزة أو كنسبة مئوية تدريجية مع توفير مسار تراجع فوري.
- رتّب العمل بحسب القيمة والمخاطر: ابدأ بمسار قليل المخاطر عالي الحركة أو سريع التغير لاكتساب الخبرة وضبط المسار، واترك الشاشات نادرة الاستخدام للنهاية (أو لا تلمسها).
- المسارات الشائعة: الترحيل من jQuery/AngularJS إلى React (تركيب جزر React داخل التطبيق القديم، أو التقسيم على مستوى المسارات)، ومن CRA إلى Vite (تبديل أداة البناء ويُمكن إنجازه في PR واحد)، ومن SPA تقليدي إلى Next.js App Router (مساراً تلو الآخر خلف البروكسي).

## Real-life example: the problem

بوابة عملاء شركة تأمين مبنية بـ AngularJS 1.x، الذي انتهت دورة دعمه رسمياً في يناير 2022 وتوقف عن تلقي التحديثات الأمنية. قرر الفريق إعادة كتابة شاملة بالكامل في Next.js بمستودع كود جديد منفصل. وبعد 18 شهراً، كانت البوابة القديمة لا تزال تستقبل ميزات عاجلة، فظل مشروع إعادة الكتابة متأخراً دائماً. وفي عطلة نهاية أسبوع الإطلاق، حوّل الفريق الـ DNS إلى التطبيق الجديد: فلم يستطع أصحاب وثائق التأمين المشتركة تنزيل وثائقهم بصيغة PDF (ميزة قديمة غير موثقة)، وأظهرت كافة الروابط المحفوظة في مفضلات العملاء خطأ 404، وسُجل خروج جميع المستخدمين قسراً لاختلاف آلية الجلسات! تم التراجع عن التحويل بعد يومين وسط خسارة فادحة لثقة إدارة الأعمال.

```nginx
# nginx.conf - BROKEN: all-or-nothing cutover
server {
  server_name portal.insurer.example;
  location / {
    # flip from legacy to new in one go on launch day
    proxy_pass http://next-app:3000;      # was: http://angularjs-app:8080
  }
}
```

```js
// new app auth - BROKEN: its own login, ignores the existing session cookie
export async function middleware(req) {
  if (!req.cookies.get('next_auth_token')) {
    return Response.redirect(new URL('/login', req.url));   // legacy users are "logged out"
  }
}
```

## How to fix it

**1. نقطة دخول موحدة، والترحيل مساراً بمسار مع الرجوع للتطبيق القديم كبديل**
```js
// next.config.js - Next.js is the front door; unmigrated paths go to the legacy app
module.exports = {
  async rewrites() {
    return {
      // beforeFiles/afterFiles omitted; fallback runs only if no Next.js page matched
      fallback: [
        { source: '/:path*', destination: `${process.env.LEGACY_ORIGIN}/:path*` },
      ],
    };
  },
};
```
تم ترحيل مساري `app/dashboard/page.tsx` و `app/claims/[id]/page.tsx` حتى الآن. ويتم تقديم بقية المسارات (`/policies/*` و `/documents/*`) عبر AngularJS من خلال المسار البديل، على نفس النطاق، وبنفس الروابط السابقة، فتظل الإشارات المرجعية تعمل بنجاح.

**2. جلسة مستخدم مشتركة: التطبيق الجديد يثق في الكوكي الحالي**
```ts
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { verifyLegacySession } from '@/lib/session';   // validates the SAME signed cookie

const MIGRATED = ['/dashboard', '/claims'];

export async function middleware(req: NextRequest) {
  if (!MIGRATED.some((p) => req.nextUrl.pathname.startsWith(p))) return NextResponse.next();
  const session = await verifyLegacySession(req.cookies.get('PORTAL_SESSION')?.value);
  if (!session) return NextResponse.redirect(new URL('/login', req.url));  // legacy login page
  return NextResponse.next();
}
```

**3. اختبارات التطابق تعمل على كلا الإصدارين قبل تحويل أي مسار**
```ts
// parity/claims.spec.ts - run with BASE_URL=legacy and BASE_URL=new
test('joint policy holder can download claim documents', async ({ page }) => {
  await loginAs(page, 'joint-policy-holder');
  await page.goto('/claims/C-1042');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  expect((await download).suggestedFilename()).toMatch(/C-1042.*\.pdf$/);
});
```

**4. إطلاق تدريجي لكل مسار**
```ts
// In middleware: send a percentage of users to the new route, sticky per user
if (pathname.startsWith('/claims') && !(await isEnabled('new-claims', session.userId))) {
  return NextResponse.rewrite(new URL(pathname + req.nextUrl.search, process.env.LEGACY_ORIGIN));
}
```
مراقبة معدل الخطأ ومؤشرات Web Vitals وتذاكر الدعم للمسار المرحل؛ وإيقاف العلم فورياً في حال حدوث أي طارئ. وعند استقرار المسار عند 100% لعدة أسابيع، يُحذف كوده القديم نهائياً.

لماذا ينجح هذا الحل: يدخل المستخدمون دائماً عبر نطاق موحد وجلسة واحدة، فتظل البنيتان غير مرئيتين للعميل؛ ويُنشر كل مسار باستقلالية مع اختبارات تثبت التكافؤ التام؛ وتُبنى الميزات الجديدة فقط على الحزمة الحديثة فيتوقف الهدف عن الحركة؛ والتراجع يتم عبر علم ميزة في ثانية واحدة بدلاً من تغييرات الـ DNS المعقدة.

## How to say it in the interview

- "أتجنب مشاريع إعادة الكتابة الشاملة المفاجئة (Big-bang)؛ بل أضع طبقة توجيه وسيطة في المقدمة، وأرحّل المسارات مساراً بمسار مع جعل التطبيق القديم هو المسار البديل fallback، ثم أحذف الكود القديم بمجرد بلوغ كل مسار نسبة 100%."
- "الجهد الخفي الحقيقي يكمن في مناطق الالتقاء المشتركة: الجلسة الموحدة، وثبات الروابط، وتطابق متغيرات التصميم والتحليلات، واختبارات التكافؤ التي تعمل على كلا النسختين."
- فخ المقابلة: "كيف تُقنع قيادات الأعمال بهذا النهج؟" - بإظهار القيمة الملموسة التراكمية: كل مسار مُرحل يُسلم بقيمة فورية محسوبة (LCP أسرع، أخطاء أقل، تسليم ميزات أسرع) دون تجميد تطوير الأعمال لشهور.
- المفاضلة (Trade-off): تشغيل بنيتين تقنيتين معاً لفترة مؤقتة يرفع التكاليف والجهد (بناءان برمجيان، ومكونات مكررة). لذا حدد ترتيباً واضحاً وتاريخاً نهائياً للإتمام، وأوقف إضافة أي ميزات جديدة على البنية القديمة.
