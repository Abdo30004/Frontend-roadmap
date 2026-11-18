# كيف تدير المصادقة (Authentication) والتفويض (Authorization) في تطبيقات الواجهة الأمامية؟

**Level:** Mid
**Merged from (original phrasings):**
- كيف تتعامل مع المصادقة (Authentication) والتفويض (Authorization) في تطبيقات الواجهة الأمامية؟

## The concept
- **المصادقة (Authentication)** تجيب عن سؤال: "من أنت؟" (تسجيل الدخول، الجلسات، الرموز المميزة). بينما **التفويض (Authorization)** يجيب عن سؤال: "ما الذي يحق لك فعله؟" (الأدوار، والصلاحيات، وملكية الموارد).
- **الحدود الأمنية الحقيقية موجودة في الخادم دائماً.** حماية المسارات في الواجهة الأمامية وإخفاء الأزرار هي مجرد تحسينات لتجربة المستخدم (UX). فأي شخص قادر على استدعاء الـ API عبر curl أو تعديل حالة الـ JS من أدوات المطور (DevTools)؛ لذا يجب أن يتحقق كل Endpoint بنفسه من صحة الجلسة وصلاحية المستخدم لكل عملية ومورد.
- **تخزين الرموز المميزة (Token Storage)**:
  - التخزين في `localStorage` أو `sessionStorage`: مقروء لأي كود جافاسكريبت يعمل في الصفحة، وبالتالي فإن أي ثغرة XSS أو سكربت تحليلات خارجي مخترق كفيل بسرقة الرمز والتحكم بالحساب بالكامل.
  - **كوكيز مع سمات httpOnly + Secure + SameSite**: لا يمكن للـ JavaScript قراءته نهائياً، ويرفقه المتصفح تلقائياً مع الطلبات. هذا هو النمط المفضل، ويفضل دعمه بطبقة BFF تحتفظ بالرموز الحقيقية على الخادم. ويجب تطبيق حماية CSRF (مثل SameSite=Lax/Strict واستخدام CSRF Token للعمليات الحساسة).
  - إذا كان لابد من استخدام الـ Bearer Tokens في تطبيقات SPA: احتفظ بـ Access Token **في الذاكرة فقط (In-memory)** وبصلاحية قصيرة (5-15 دقيقة)، مع وضع الـ Refresh Token في **كوكيز httpOnly** يتم تدويره مع كل استخدام.
- **آلية تجديد الرمز (Refresh Flow)**: عند استلام رمز 401، نفذ طلب التجديد مرة واحدة وصفّ بقية الطلبات الفاشلة مؤقتاً حتى يكتمل التجديد ثم أعد محاولتها. وإن فشل التجديد، سجل خروج المستخدم فوراً.
- **حراس المسارات (Route Guards)**: التحقق من الجلسة قبل تصيير الصفحات المحمية (في Middleware أو على الخادم في Layout/Page بـ Next.js) لمنع ظهور أي لمحة من المحتوى المحمي لغير المصرح لهم، وإعادة التوجيه لصفحة تسجيل الدخول مع معامل `returnTo`.
- **التفويض على مستوى الواجهة**: يرسل الخادم صلاحيات المستخدم وتقوم الواجهة بإخفاء أو تعطيل الأزرار لتوفير تجربة استخدام واضحة ومريحة.

## Real-life example
في تطبيق فواتير للشركات (B2B SaaS)، كشف تدقيق أمني عن ثغرتين خطيرتين: (1) كان رمز JWT مخزناً في `localStorage`، ويحمل التطبيق أداة محادثة دعم تابعة لطرف ثالث، مما يمكن أي سكربت في الصفحة من قراءة الرمز وانتحال هوية المستخدم لمدة 30 يوماً. (2) كان زر "حذف الفاتورة" مخفياً للمستخدمين غير المديرين، ولكن الـ API لم يتحقق من صلاحية الدور. قام مستخدم يحمل دور "مشاهد" (Viewer) بفتح أدوات المطور وأعاد إرسال طلب `DELETE /invoices/:id`، فتمكن من حذف فواتير الشركة بأكملها!

```jsx
// تسجيل الدخول
const { token } = await api.post('/login', creds);
localStorage.setItem('token', token);              // مقروء لأي سكربت يعمل في الصفحة!

// عميل الـ API
axios.defaults.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;

// تفويض صوري على مستوى الواجهة فقط
function InvoiceActions({ invoice, user }) {
  return user.role === 'admin' ? <button onClick={() => api.delete(`/invoices/${invoice.id}`)}>Delete</button> : null;
}
```

```js
// الخادم: يتحقق من وجود المستخدم لكنه لا يفوض الصلاحية مطلقاً!
app.delete('/invoices/:id', requireLogin, async (req, res) => {
  await db.invoices.delete(req.params.id);          // أي مستخدم مسجل يستطيع حذف فواتير أي شركة!
  res.sendStatus(204);
});
```

## How to fix it
**على الخادم: إدارة الجلسة عبر كوكيز httpOnly والتحقق الصارم من الصلاحيات مع كل Endpoint:**
```js
app.post('/login', async (req, res) => {
  const user = await verifyCredentials(req.body);
  const sessionId = await sessions.create(user.id, { ttl: '8h' });
  res.cookie('sid', sessionId, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  res.json({ id: user.id, name: user.name, permissions: user.permissions }); // لا تُرسل رموزاً سرية في الجسم
});

app.delete('/invoices/:id', requireSession, async (req, res) => {
  const invoice = await db.invoices.find(req.params.id);
  if (!invoice || invoice.companyId !== req.user.companyId) return res.sendStatus(404); // عزل الشركات المستأجرة
  if (!req.user.permissions.includes('invoice:delete')) return res.sendStatus(403);    // فحص الصلاحية الدقيقة
  await db.invoices.delete(invoice.id);
  res.sendStatus(204);
});
```

**في Next.js: حماية المسارات قبل التصيير وإخفاء عناصر الواجهة:**
```js
// middleware.js: إعادة توجيه سريعة في حال غياب الجلسة
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
// app/app/layout.jsx: التحقق الحقيقي من صحة الجلسة على الخادم
import { getCurrentUser } from '@/server/auth';
import { redirect } from 'next/navigation';

export default async function AppLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <PermissionsProvider value={user.permissions}>{children}</PermissionsProvider>;
}

// تفويض على مستوى الواجهة: لتجربة المستخدم فقط، بينما الخادم هو من يفرض الحماية الحقيقية
function Can({ permission, children }) {
  const permissions = usePermissions();
  return permissions.includes(permission) ? children : null;
}
// <Can permission="invoice:delete"><DeleteButton id={invoice.id} /></Can>
```
سبب نجاح الحل: لا يمكن لأي كود جافاسكريبت دخيل قراءة معرف الجلسة بفضل سمة `httpOnly`، ويُرسل عبر اتصالات HTTPS المشفرة فقط (`Secure`). ويتحقق الـ API من هوية الشركة ومن الصلاحية الدقيقة (`invoice:delete`)، فتفشل الطلبات المزيفة برمز 403. وتمنع الحماية في الـ Layout إرسال أي محتوى محمي للمستخدمين المجهولين.

## How to say it in the interview
- "الأمان في الواجهة الأمامية يتعلق بتجربة المستخدم (حراس المسارات، وإخفاء الأزرار، والتحويل). أما الأمان الحقيقي فيُفرض على الخادم في كل طلب منفرد: مصادقة الجلسة أولاً، ثم تفويض الصلاحية الدقيقة على المورد المطلوب."
- "أفضل كوكيز httpOnly و Secure و SameSite على localStorage؛ فثغرات XSS والسكربتات الخارجية لا تستطيع سرقة ما لا تستطيع الجافاسكريبت قراءته. ويقترن ذلك بحماية الـ CSRF."
- سؤال متابعة: "كيف تجدد الرموز المميزة (Refresh Flow)؟" باستخدام Access Token قصير الأجل في الذاكرة مع Refresh Token يُدار في كوكيز httpOnly مع التدوير، وتوحيد طلبات التجديد المتزامنة عند استلام خطأ 401.
- الموازنة (Trade-off): جلسات الخادم سهلة الإبطال فوراً لكنها تتطلب مخزناً للجلسات. أما رموز JWT غير المعتمدة على الحالة (Stateless) فتتوسع بسهولة ولكن يصعب إبطالها قبل انتهاء مدتها، لذا يجب أن تكون قصيرة الأجل دوماً.
