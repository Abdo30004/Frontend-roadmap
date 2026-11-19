# كيف تطبق التحميل الكسول (Lazy Loading) وتقسيم الكود على مستوى المسارات (Route-based Code Splitting) في React؟

**Level:** Mid
**Merged from (original phrasings):**
- كيف تطبق الـ Lazy Loading وتقسيم الكود القائم على المسارات (Route-based Code Splitting)؟
- كيف تطبق الـ Lazy Loading والـ Code Splitting في React؟
- كيف تحسن تقسيم الحزم (Bundle Splitting) لأقصى أداء ممكن عبر مختلف المسارات؟

## The concept
- **تقسيم الكود (Code Splitting)**: يقسم حزمة الجافاسكريبت الكبيرة إلى حزم فرعية (Chunks) تُحمّل حسب الطلب. وتقوم أدوات التجميع (Vite / Rollup، webpack، Turbopack) بإنشاء حزمة منفصلة تلقائياً عند كل استدعاء `import()` ديناميكي.
- **`React.lazy(() => import('./Page'))`** مع **`<Suspense fallback>`**: يصيّران المكون بتحميل كوده عند تصييره للمرة الأولى فقط. ويجب أن يحتوي الملف المستورد على تصدير افتراضي (default export).‏
- **التقسيم على مستوى المسارات (Route-level splitting)**: هو أكبر وأسهل مكسب لأداء التطبيق، حيث يحمّل المستخدم كود الصفحة التي يفتحها فقط. في Next.js App Router يتم هذا تلقائياً لكل مسار؛ ومع React Router نستخدم المسارات الكسولة (lazy routes).‏
- **التقسيم على مستوى المكونات (Component-level splitting)**: للمكونات الثقيلة غير المرئية فوراً: مثل محررات النصوص الغنية، والرسوم البيانية، والخرائط، والنوافذ المنبثقة (Modals)، ولوحات الإدارة. في Next.js: نستخدم `next/dynamic` (مع `ssr: false` للمكتبات التي تعتمد على المتصفح فقط).‏
- **الجلب المسبق (Prefetch)**: لإخفاء تأخير الشبكة، ابدأ استدعاء `import()` عند تمرير الفأرة (hover)، أو التركيز (focus)، أو عندما يكون المتصفح في وضع خمول (idle). ومكون `<Link>` في Next.js يجلب المسارات المرئية تلقائياً في الإنتاج.
- **حزم المكتبات المستقلة (Vendor Chunks)**: عزل المكتبات الأساسية الثابتة (مثل react، react-dom، router) في حزمة منفصلة طويلة التخزين المؤقت؛ وتجنب وضع كل المكتبات الخارجية في حزمة "vendor" واحدة عملاقة يضطر كل مسار لتحميلها. حلل الحزم دائماً عبر `rollup-plugin-visualizer` أو `@next/bundle-analyzer`.‏
- تعامل دوماً مع **فشل تحميل الحزم (Chunk load errors)** (بعد رفع تحديث جديد، قد تعيد الحزم القديمة خطأ 404) عبر Error Boundary وزر تحديث للصفحة.

## Real-life example
لوحة تحكم لتطبيق مصرفي مبنية بنظام SPA عبر Vite و React Router. تُستورد كل الصفحات مباشرة في أعلى ملف `App.jsx`، بما في ذلك عارض كشوفات PDF الثقيل (pdf.js)، وصفحة الاستثمارات التي تحتوي على مكتبة رسوم بيانية ضخمة، ولوحة تحكم الإدارة. يبلغ حجم الحزمة الأساسية 2.4MB! وعلى شبكة 4G في الهاتف، تستغرق شاشة تسجيل الدخول 7 ثوانٍ كاملة لتصبح تفاعلية، على الرغم من أن المستخدم لا يحتاج في البداية سوى حقلين للدخول!

```jsx
// App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Accounts from './pages/Accounts';
import Investments from './pages/Investments';   // يستورد مكتبة رسوم بيانية ضخمة
import Statements from './pages/Statements';     // يستورد pdf.js
import AdminPanel from './pages/AdminPanel';     // يستخدمه 1% فقط من المستخدمين

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Accounts />} />
        <Route path="/investments" element={<Investments />} />
        <Route path="/statements" element={<Statements />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </BrowserRouter>
  );
}
```

## How to fix it
```jsx
// App.jsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Login from './pages/Login';            // إبقاء صفحة الدخول في الحزمة الأساسية
import { RouteErrorBoundary } from './RouteErrorBoundary';

const loadAccounts = () => import('./pages/Accounts');
const loadInvestments = () => import('./pages/Investments');
const loadStatements = () => import('./pages/Statements');

const Accounts = lazy(loadAccounts);
const Investments = lazy(loadInvestments);
const Statements = lazy(loadStatements);
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

export default function App() {
  return (
    <BrowserRouter>
      <RouteErrorBoundary>                      {/* يلتقط أخطاء فشل تحميل الحزم */}
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Accounts />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/statements" element={<Statements />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}

// الجلب المسبق عند التمرير أو التركيز: تكون الحزمة جاهزة غالباً قبل انتهاء النقرة
export function NavLinkPrefetch({ to, load, children }) {
  return (
    <Link to={to} onMouseEnter={load} onFocus={load}>
      {children}
    </Link>
  );
}
// <NavLinkPrefetch to="/investments" load={loadInvestments}>الاستثمارات</NavLinkPrefetch>

// بعد الدخول، يتم تحضير الصفحة التالية الأكثر احتمالاً عندما يكون المتصفح في وضع خمول
window.requestIdleCallback?.(() => loadAccounts());
```

```js
// vite.config.js: حزمة React Vendor مستقرة وتخزين مؤقت طويل، والمكتبات الثقيلة تتبع مسارها فقط
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) {
            return 'react-vendor'; // نادرة التغير -> تظل مخزنة في كاش المتصفح عبر عمليات النشر المتكررة
          }
          // لم ندرج pdf.js ومكتبة الرسوم: فهما يُحزمان فقط مع صفحات Statements و Investments،
          // ولن تحملهما بقية المسارات أبداً
        },
      },
    },
  },
};
```
سبب نجاح الحل: صفحة تسجيل الدخول أصبحت تشحن كود الدخول فقط مع حزمة React المشتركة. وكل مسار يحمل حزمته الخاصة عند زيارته لأول مرة، والمكتبات الثقيلة لا تُحمل إلا داخل الصفحات التي تستخدمها بالفعل. الجلب المسبق (Prefetching) عند التمرير أو الخمول يخفي تأخير الشبكة تماماً فتبدو التنقلات فورية، وتفصل حزمة Vendor المستقرة التخزين المؤقت عن عمليات النشر اليومية.

في Next.js App Router، تُقسم المسارات تلقائياً. وللمكونات الثقيلة:
```jsx
'use client';
import dynamic from 'next/dynamic';

const StatementViewer = dynamic(() => import('./StatementViewer'), {
  ssr: false, loading: () => <PageSkeleton />,
});
```

## How to say it in the interview
- "أبدأ بالتقسيم على مستوى المسارات أولاً لأنه يحقق أكبر وفر في حجم الحزم، ثم أطبق التحميل الكسول (Lazy load) للمكونات الثقيلة غير المرئية فوراً في الشاشة الأولى، مثل المحررات والرسوم والخرائط والنوافذ المنبثقة."
- "`React.lazy` مقترناً بـ `Suspense` ينشئ حزمة منفصلة لكل استيراد ديناميكي. ولتفادي ظهور مؤشرات التحميل أثناء التنقل، أستخدم الجلب المسبق (Prefetch) عند الـ hover أو وقت خمول المتصفح."
- فخ شائع: تطبيق التحميل الكسول على كل شيء دون تمييز، بما في ذلك المكونات الصغيرة أو محتوى الشاشة الأولى (Above-the-fold)؛ فهذا ينشئ شلال طلبات بطيء ومؤشرات انتظار متناثرة تضر بمؤشر LCP بشدة.
- الموازنة (Trade-off): زيادة عدد الحزم تقلل وقت التحميل الأولي وتحسن التخزين المؤقت، ولكن الإفراط الشديد في تفتيت الحزم يضيف تكلفة طلبات شبكة إضافية. استخدم محلل الحزم (Bundle Analyzer) دائماً لكشف الفرص الحقيقية، واحرص على معالجة أخطاء تحديث الحزم بعد النشر.
