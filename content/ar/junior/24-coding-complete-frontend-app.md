# تمرين عملي: بناء تطبيق واجهة مستخدم متكامل في مقابلة عمل

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- بناء تطبيق واجهة أمامية متكامل يستهلك واجهات برمجة التطبيقات (APIs)، ويدير الحالة، ومتجاوب بالكامل.

## The concept (short answer)
- يركز مقيّمو المشاريع العملية المنزلية (Take-home projects) على هيكلية الكود ومتانته أكثر من كثرة الميزات: مجلدات واضحة، **طبقة بيانات منفصلة**، اختيارات منطقية للـ **state**، **توجيه سليم**، **معالجة حالات التحميل والأخطاء والفراغ**، **تخطيط متجاوب**، وملف README احترافي.
- الحزمة التقنية الموصى بها لمستوى Junior: تقنية React + Vite (أو Next.js)، ومكتبة React Router للتوجيه، ومكتبة **TanStack Query** لإدارة حالة الخادم (Server state)، و `useState` أو Context للحالة المحلية البسيطة، وملفات CSS Modules أو Tailwind، مع اختبارات عبر Vitest و RTL.
- افصل بين نوعين من الحالة: **حالة الخادم (Server state)** (بيانات الـ APIs: تخزين مؤقت، إعادة جلب، وقابلة لأن تصبح قديمة) وتنتمي لمكتبة جلب بيانات؛ و**حالة العميل (Client state)** (القوائم المفتوحة، المظهر الداكن، والمرشحات) وتبقى محلية أو في Context. وتجنب وضع بيانات الـ API في Redux يدوياً ما لم يُطلب منك ذلك صراحة.
- تمر كافة استدعاءات HTTP عبر **عميل API موحد (API client)** (رابط أساسي، ترويسات، معالجة أخطاء موحدة) ودوال أو خطافات مخصصة (`useProducts`). ولا تستدعي المكونات دالة `fetch` مباشرة أبداً.
- كل شاشة غير متزامنة يجب أن تعالج الحالات الأربع: **التحميل (loading)، والخطأ مع إعادة المحاولة (error with retry)، والحالة الفارغة (empty)، وحالة النجاح (success)**. مع تصميم متجاوب بأسلوب الهاتف أولاً عبر Grid و Flexbox.

الهيكلية الموصى بها للمشروع:

```
src/
  api/
    client.js          # غلاف لـ fetch: الرابط الأساسي، فك JSON، الأخطاء، وترويسات المصادقة
    products.js        # getProducts, getProduct
  features/
    products/
      useProducts.js   # خطافات TanStack Query
      ProductList.jsx
      ProductCard.jsx
      ProductCard.module.css
  components/          # مكونات عامة: Spinner, ErrorMessage, EmptyState, Layout
  pages/               # مكونات المسارات: HomePage, ProductPage, NotFound
  App.jsx              # المزودات (Providers) والمسارات
  main.jsx
```

## Real-life example: the problem
حالة شائعة: تم رفض مشروع اختباري منزلي "كتالوج منتجات" قدمه أحد المرشحين. وكانت ملاحظات المقيّمين: "رابط الـ API مكتوب برمجياً بشكل مكرر في 6 مكونات، غياب حالة التحميل (شاشة بيضاء فارغة لمدة ثانيتين)، انهيار التطبيق بالخطأ 'Cannot read properties of undefined (reading map)' عند تعطل الخادم، التخطيط ينكسر ويتشوه عند العرض الأقل من 900 بكسل، وغياب تام لملف README."

```jsx
// ProductsPage.jsx: كل شيء مكدس في مكون واحد مشوه
export default function ProductsPage() {
  const [products, setProducts] = useState();

  useEffect(() => {
    fetch("https://fakestoreapi.com/products")        // مكرر في عدة ملفات
      .then((r) => r.json())
      .then((data) => setProducts(data));             // لا معالجة أخطاء، ولا فحص لـ res.ok
  }, []);

  return (
    <div style={{ display: "flex", width: "1200px" }}> {/* عرض ثابت يكسر الشاشات الصغيرة */}
      {products.map((p) => (                          // ينهار: products تكون undefined في البداية
        <div style={{ width: "300px" }} onClick={() => (window.location.href = `/p/${p.id}`)}>
          <img src={p.image} width="300" />
          <b>{p.title}</b>
        </div>
      ))}
    </div>
  );
}
```

## How to fix it
1. عميل API موحد مع معالجة الأخطاء:

```js
// src/api/client.js
const BASE_URL = import.meta.env.VITE_API_URL;      // مهيأ عبر متغيرات البيئة .env

export async function apiGet(path, { signal } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

// src/api/products.js
export const getProducts = ({ signal }) => apiGet("/products", { signal });
export const getProduct = (id, { signal }) => apiGet(`/products/${id}`, { signal });
```

2. إدارة حالة الخادم عبر خطافات TanStack Query:

```js
// src/features/products/useProducts.js
import { useQuery } from "@tanstack/react-query";
import { getProducts, getProduct } from "../../api/products";

export const useProducts = () =>
  useQuery({ queryKey: ["products"], queryFn: getProducts, staleTime: 60_000 });

export const useProduct = (id) =>
  useQuery({ queryKey: ["product", id], queryFn: ({ signal }) => getProduct(id, { signal }) });
```

3. قشرة التطبيق والمزودات والتوجيه:

```jsx
// src/App.jsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="products/:id" element={<ProductPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

4. مكون يعالج كافة الحالات الأربع بأناقة:

```jsx
// src/features/products/ProductList.jsx
import { Link } from "react-router-dom";
import { useProducts } from "./useProducts";
import styles from "./ProductList.module.css";

export function ProductList() {
  const { data: products, isPending, isError, error, refetch } = useProducts();

  if (isPending) return <Spinner label="Loading products" />;
  if (isError) return <ErrorMessage message={error.message} onRetry={refetch} />;
  if (products.length === 0) return <EmptyState text="No products yet." />;

  return (
    <ul className={styles.grid}>
      {products.map((p) => (
        <li key={p.id}>
          <Link to={`/products/${p.id}`} className={styles.card}>
            <img src={p.image} alt={p.title} loading="lazy" />
            <h3>{p.title}</h3>
            <p>{p.price.toFixed(2)} EUR</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

5. كود CSS متجاوب بأسلوب الهاتف أولاً:

```css
/* ProductList.module.css */
.grid {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
  list-style: none;
}
.card { display: flex; flex-direction: column; gap: 0.5rem; }
.card img { width: 100%; aspect-ratio: 1; object-fit: contain; }
```

لماذا ينجح هذا الحل:
- توحيد طبقة الـ API: تغيير الرابط الأساسي، أو إضافة ترويسات المصادقة، أو التعامل مع رمز 401 يتم في ملف واحد، وتظل المكونات نظيفة وسهلة الاختبار.
- توفر TanStack Query التخزين المؤقت، وإلغاء تكرار الطلبات، وإعادة المحاولة التلقائية، وإلغاء الطلبات، وإشارات التحميل والأخطاء، ملغيةً الحاجة لجلب البيانات يدوياً بـ `useEffect` وحاميةً من مشاكل الـ race conditions.
- يعرض المكون واجهة مستخدم واضحة لكل حالة، فلا تؤدي شبكة بطيئة أو خادم معطل إلى شاشة بيضاء أو انهيار.
- يمنح وسم `<Link>` تنقلاً سلساً في جانب العميل وروابط حقيقية تدعم لوحة المفاتيح وإمكانية الوصول، بدلاً من أحداث النقر العشوائية على `div`.
- تتكيف الشبكة تلقائياً من عمود واحد على الهواتف إلى عدة أعمدة على الشاشات الكبيرة دون أشرطة تمرير أفقية.

اختم مشروعك بـ: مكون حدود أخطاء عام (Error boundary)، وملف `.env.example`، و 3 إلى 5 اختبارات RTL للمسارات الأساسية، وملف README يوضح خطوات التشغيل والقرارات الهندسية المتبعة.

## How to say it in the interview
- "أفصل المسؤوليات باحترافية: عميل API وخطافات مخصصة للبيانات، و TanStack Query لحالة الخادم، و state محلية أو Context لحالة واجهة المستخدم، ومسارات واضحة مع مكونات عرض تقديمية صغيرة."
- "كل واجهة غير متزامنة تمتلك حالات التحميل، والخطأ مع زر إعادة المحاولة، والفراغ، والنجاح؛ مع تخطيط متجاوب بأسلوب الهاتف أولاً عبر CSS Grid."
- سؤال المتابعة: "لماذا لم تستخدم Redux؟" معظم حالة التطبيقات المعاصرة هي Server state تتقن مكتبات الاستعلام إدارتها؛ ويكون Redux مبرراً للحالات المعقدة المشتركة الخاصة بجانب العميل فقط.
- المفاضلة: تسرع المكتبات الخارجية الإنجاز ولكنها تضيف اعتماديات؛ وفي المشاريع العملية المنزلية اشرح أسباب اختيار كل مكتبة في ملف الـ README، فالمقيّمون يقدرون التفكير المنطقي بقدر تقديرهم لجودة الكود.
