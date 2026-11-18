# كيف يعمل التوجيه من جانب العميل (Client-Side Routing) في React Router؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- كيف تطبق التوجيه (Routing) في React باستخدام react-router-dom؟

## The concept (short answer)
- تطبيقات React هي في الغالب **تطبيقات الصفحة الواحدة (SPAs)**: يرسل الخادم صفحة HTML واحدة فقط، ويحدد الموجه (Router) المكون الذي يجب عرضه بناءً على رابط الـ URL الحالي، **دون إعادة تحميل كامل الصفحة**. ويعتمد في ذلك على واجهة المتصفح History API (`pushState`).
- المكونات الأساسية في الإصدار v6 وما بعده (وهي ذاتها في v7 عبر حزمة `react-router`):
  - `createBrowserRouter` + `<RouterProvider>` (النمط الموصى به "data router")، أو `<BrowserRouter>` + `<Routes>` + `<Route>`.
  - روابط `<Link to="/x">` و `<NavLink>` للتنقل الداخلي (دون إعادة تحميل). استخدام وسوم `<a href>` التقليدية يُحدث **إعادة تحميل كاملة** للصفحة وتفقد الحالة المخزنة في الذاكرة.
  - دالة `()useNavigate` للتنقل برمجياً في الكود (بعد إرسال نموذج مثلاً).
  - خطاف `()useParams` للأجزاء الديناميكية مثل `/products/:id`؛ و `()useSearchParams` لمعاملات الاستعلام مثل `?sort=price`.
  - **المسارات المتداخلة (Nested routes)** مع مكون `<Outlet />` لتشارك التخطيطات العامة (التخريجة، الترويسة، الشريط الجانبي).
  - مسار شامل `path="*"` لصفحات 404، وخاصية `errorElement` للتعامل مع الأخطاء غير المتوقعة.
- حماية الصفحات (Protected routes): نتحقق من مصادقة المستخدم في مسار تخطيط ونوجهه إلى `<Navigate to="/login" replace />`. هذا إجراء مخصص **لتجربة المستخدم (UX)** فقط؛ ولا بد للـ API في الخادم من فحص الصلاحيات فعلياً.
- عند النشر (Deployment): يجب على الخادم إعادة توجيه كافة الطلبات إلى `index.html`، وإلا فإن تحديث الصفحة عند المسارات الفرعية سينتج عنه خطأ **404**.

## Real-life example: the problem
تخيّل متجراً إلكترونياً. أبلغ المستخدمون بما يلي: النقر على أي منتج في القائمة يؤدي إلى **إعادة تحميل كامل الصفحة** و**إفراغ سلة المشتريات تماماً**؛ صفحة المنتج تعرض نفس المنتج دائماً بغض النظر عن الرابط المطلوب؛ المستخدمون غير المسجلين يمكنهم فتح رابط `/account` فتظهر لهم صفحة معطلة؛ والترويسة العلوية تختفي تماماً عند فتح صفحات المنتجات.

```jsx
// BROKEN: App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<><Header /><Home /></>} />
        <Route path="/products" element={<ProductList />} />          {/* تختفي الترويسة هنا */}
        <Route path="/products/id" element={<ProductPage />} />        {/* نص "id" حرفي وليس معاملاً ديناميكياً */}
        <Route path="/account" element={<Account />} />               {/* لا يوجد أي فحص للمصادقة */}
      </Routes>
    </BrowserRouter>
  );
}

function Header() {
  return (
    <nav>
      <a href="/products">Products</a>  {/* إعادة تحميل كاملة -> فقدان محتوى السلة المخزن في الذاكرة */}
    </nav>
  );
}

function ProductPage() {
  const product = useProduct(1); // معرف ثابت ومكتوب برمجياً
  return <h1>{product.name}</h1>;
}
```

## How to fix it

```jsx
// FIXED: main.jsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,          // الترويسة المشتركة + <Outlet />
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Home /> },
      { path: 'products', element: <ProductList /> },
      { path: 'products/:productId', element: <ProductPage /> },
      {
        element: <RequireAuth />,     // مسار تخطيط يحمي المسارات التابعة له
        children: [{ path: 'account', element: <Account /> }],
      },
      { path: 'login', element: <Login /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
```

```jsx
// FIXED: التخطيط العام، الروابط، المعاملات، الحماية
import { NavLink, Outlet, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';

function RootLayout() {
  return (
    <>
      <nav>
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/products">Products</NavLink> {/* تنقل من جانب العميل دون إعادة تحميل */}
        <NavLink to="/account">Account</NavLink>
      </nav>
      <main>
        <Outlet /> {/* يتم تصيير المسار الابن هنا */}
      </main>
    </>
  );
}

function ProductPage() {
  const { productId } = useParams();       // "42" للرابط /products/42 (سلسلة نصية دائماً)
  const navigate = useNavigate();
  const product = useProduct(productId);

  if (!product) return <p>Loading...</p>;
  return (
    <>
      <h1>{product.name}</h1>
      <button onClick={() => navigate('/products')}>Back to products</button>
    </>
  );
}

function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    // تذكر الصفحة التي أراد المستخدم الذهاب إليها؛ مع replace لتفادي حلقة زر الرجوع
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
```

لماذا ينجح هذا الحل:
- تقوم روابط `NavLink` و `Link` بتغيير الرابط عبر History API، مما يُبقي كود React نشطاً وتصمد الحالة المخزنة في الذاكرة (سلة التسوق). وتضيف `NavLink` تلقائياً صنف `active` لتنسيق الرابط النشط.
- التعبير `:productId` هو جزء ديناميكي يُقرأ عبر `useParams`.
- المسارات المتداخلة مع `<Outlet />` تُبقي الترويسة ثابتة في كل الصفحات؛ ومسار الحماية يجعل أي صفحة تُضاف تحته محمية تلقائياً.
- المسار `path="*"` يلتقط العناوين غير المعروفة؛ ومكون `errorElement` يلتقط أخطاء التصيير في المسارات.

ملاحظة بديلة: استخدام كود JSX المتداخل بـ `<BrowserRouter>` و `<Routes>` يحمل نفس المبادئ تماماً. أما في **Next.js**، فلا نستخدم react-router إطلاقاً؛ بل يعتمد التوجيه على بنية المجلدات والملفات (`app/products/[id]/page.tsx`).

## How to say it in the interview
- "يربط react-router الروابط بالمكونات في جانب العميل باستخدام History API دون إعادة تحميل الصفحة. وأستخدم `createBrowserRouter` مع المسارات المتداخلة ومكون `<Outlet />` للتخطيطات، و `:params` مع `useParams`، والمسار `*` لصفحات 404."
- "أتنقل باستخدام `<Link>` أو `<NavLink>`، أو برمجياً عبر `useNavigate`؛ أما وسم `<a href>` التقليدي فيتسبب في إعادة تحميل كاملة وفقدان الحالة."
- فخ المقابلة: تحديث صفحة `/products/42` يعطي خطأ 404 في بيئة الإنتاج ما لم يتم ضبط خادم الويب ليعيد توجيه الطلبات إلى `index.html`.
- المفاضلة: حماية المسارات في المتصفح هي لتحسين تجربة المستخدم فقط؛ والأمان الحقيقي يقع على عاتق الخادم والـ API. وللتطبيقات الكبيرة، نستخدم التحميل الكسول للمسارات عبر `React.lazy` للحفاظ على صغر حجم حزمة الجافاسكريبت الأولى.
