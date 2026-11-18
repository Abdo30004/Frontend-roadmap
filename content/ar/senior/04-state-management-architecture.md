# معمارية إدارة الحالة: Redux Toolkit مقابل Context مقابل Zustand مقابل مكتبات Server-State

**Level:** Senior
**Merged from (original phrasings):**
- المقارنة بين Redux Toolkit و Context API ومكتبات حالة الخادم (Server-State): متى تختار كلاً منها؟
- اشرح المفاضلات الهندسية بين أنماط إدارة الحالة المختلفة (Redux و Zustand و Context API).
- كيف تدير الحالة والتخزين المؤقت (Caching) عندما يتوسع التطبيق ليتجاوز أكثر من 100 شاشة؟

## The concept (short answer)

الخطوة الاحترافية لمهندس الـ Senior هي التوقف عن التساؤل "أي مكتبة نختار؟" والبدء أولاً **بتصنيف نوع الحالة (State)**، لأن لكل نوع مالكاً ودورة حياة مختلفة كلياً:

| النوع | أمثلة | المكان الأمثل لها |
|---|---|---|
| **حالة الخادم (Server state)** | الطلبات، المستخدمون، الأسعار - تعود ملكيتها للـ Backend وقابلة لأن تصبح قديمة (stale) | TanStack Query / RTK Query / SWR (كاش، منع التكرار، إبطال الصلاحية، وإعادة الجلب) |
| **حالة الرابط (URL state)** | الفلاتر، الترتيب، رقم الصفحة، التبويب المحدد، البحث | الرابط URL عبر (`useSearchParams`) - قابل للمشاركة، ينجو من التحديث، ويعمل زر الرجوع معه بسلاسة |
| **حالة النماذج (Form state)** | التعديلات الجارية، أخطاء التحقق | الحالة المحلية `useState` أو React Hook Form، ويتم التخلص منها بعد الإرسال |
| **حالة العميل / الواجهة (Client/UI state)** | فتح القائمة الجانبية، المظهر (Theme)، معالج الخطوات المتعددة، السلة قبل الشراء | `useState` -> الرفع للأعلى (lift up) -> ثم Zustand/Redux عندما تكون عامة بالفعل |

مفاضلات المكتبات لما يتبقى من *حالة العميل*:
- **Context API:** حقن للتبعيات (Dependency Injection)، وليست أداة لإدارة الحالة. يُعاد تصيير كل مكون مستهلك عند تغير القيمة، ولا تدعم محددات (selectors). ممتازة للقيم نادرة التغير (السمة Theme، اللغة، المستخدم الحالي، أعلام الميزات).
- **Redux Toolkit:** مخزن مركزي وحيد، تدفق أحادي الاتجاه صارم، أدوات تطوير تدعم السفر عبر الزمن (Time Travel)، ودعم البرمجيات الوسيطة (middleware). مثالية للفرق الضخمة التي تحتاج معايير موحدة ومنطقاً برمجياً معقداً مشتركاً بين الميزات. تتطلب قدراً أكبر من الكود المكتبي (ceremony)؛ وتغطي RTK Query حالة الخادم بسلاسة إذا كنت تستخدم Redux بالفعل.
- **Zustand:** متناهية الصغر، مبنية على الـ Hooks، تدعم الاشتراكات عبر المحددات (re-render فقط للشريحة المقروءة)، وتعمل حتى خارج بيئة React. تتسم بهيكل تنظيمي أقل صرامة - مما يتطلب اتفاق الفريق على قواعد محددة.

عند الوصول إلى **100+ شاشة**: يتضح أن أغلب ما كان يُسمى "Global State" ليس سوى كاش لبيانات الخادم. حافظ على مصنع لمفاتيح الاستعلام (query-key factory) لكل ميزة، وحدد مدة `staleTime` لكل نوع بيانات، وأبطل الكاش عبر بادئة المفتاح (key prefix) بعد التعديلات (mutations)، وضع المخازن بجانب ميزاتها (تجنب إنشاء مخزن شامل ضخم god-store)، واقصر الحالة العامة (Global) على ما هو مشترك فعلياً بين واجهات العميل.

## Real-life example: the problem

تطبيق لوجستي للعمليات الخلفية. تم جلب قائمة الطلبات مرة واحدة ونسخها بالكامل داخل Redux. يفتح موظف التوزيع طلباً، ويغير حالته إلى "Shipped"، ثم يعود - فيجد القائمة لا تزال تعرض "Pending". والتعديلات التي يُجريها زملاؤه لا تظهر إطلاقاً إلا بعد إعادة تحميل الصفحة بالكامل. حاول أحدهم "إصلاح" المشكلة بإعادة جلب البيانات في خمسة أماكن متفرقة، فبدأت القائمة بالوميض وإطلاق طلبات شبكة مكررة.

```jsx
// ordersSlice.js - server data cloned into client state
const ordersSlice = createSlice({
  name: 'orders',
  initialState: { items: [], loading: false, filter: 'all' },
  reducers: {
    setOrders: (s, a) => { s.items = a.payload; },
    setLoading: (s, a) => { s.loading = a.payload; },
    setFilter: (s, a) => { s.filter = a.payload; },
  },
});

function OrdersPage() {
  const dispatch = useDispatch();
  const { items, filter } = useSelector((s) => s.orders);
  useEffect(() => {
    if (items.length === 0) {                 // "cache": never refetches once filled
      dispatch(setLoading(true));
      fetch('/api/orders').then((r) => r.json()).then((d) => dispatch(setOrders(d)));
    }
  }, []);
  return <OrdersTable orders={items.filter((o) => filter === 'all' || o.status === filter)} />;
}

function OrderDetail({ id }) {
  const ship = () => fetch(`/api/orders/${id}/ship`, { method: 'POST' });  // list never learns about it
  /* ... */
}
```

المشكلات: كاش يدوي بدائي يفتقر لمفاهيم تقادم البيانات (staleness)، وإبطال الصلاحية (invalidation)، ومنع التكرار (deduplication)، وإعادة الجلب عند تركيز النافذة؛ كما وُضع الفلتر داخل Redux مما منع مشاركته في الروابط أو حفظه بالإشارات المرجعية وأدى لفقده فور إعادة التحميل.

## How to fix it

ضع حالة الخادم في كاش استعلامات مخصص، والفلتر في الـ URL، واقصر Redux أو Zustand على حالة العميل الحقيقية.

```jsx
// orders/queries.js - one key factory per feature
export const orderKeys = {
  all: ['orders'],
  list: (status) => ['orders', 'list', { status }],
  detail: (id) => ['orders', 'detail', id],
};

export function useOrders(status) {
  return useQuery({
    queryKey: orderKeys.list(status),
    queryFn: ({ signal }) => fetch(`/api/orders?status=${status}`, { signal }).then((r) => r.json()),
    staleTime: 30_000,            // fresh for 30s, then revalidated in background on mount/focus
  });
}

export function useShipOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => fetch(`/api/orders/${id}/ship`, { method: 'POST' }).then((r) => r.json()),
    onSuccess: (updated) => {
      qc.setQueryData(orderKeys.detail(updated.id), updated);
      qc.invalidateQueries({ queryKey: orderKeys.all });   // every list variant refetches
    },
  });
}

// OrdersPage.jsx - filter lives in the URL
function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'all';
  const { data = [], isPending, error } = useOrders(status);
  /* ... setParams({ status: 'pending' }) on filter change ... */
}

// ui store (Zustand) - only true client state
export const useUiStore = create((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
```

لماذا ينجح هذا الحل: يظل الـ Backend هو المصدر الوحيد للحقيقة؛ ويعرف كاش الاستعلامات بدقة عمر كل مدخل، ويمنع تكرار الطلبات المتزامنة، ويُعيد الجلب تلقائياً عند تركيز الشاشة، كما أن إبطال الصلاحية عبر بادئة المفتاح يُحدث كافة القوائم بعد اكتمال التعديل. ويجعل وضع الفلاتر في الـ URL الحالة قابلة للمشاركة والحفظ. لم يعد Redux نسخة قديمة تالفة من قاعدة البيانات. وإذا كان الفريق مستثمراً بالفعل في Redux، فإن RTK Query عبر خاصيتي `providesTags`/`invalidatesTags` تُحقق نفس النتيجة تماماً.

## How to say it in the interview

- "أبدأ دائماً بتفكيك الحالة إلى أربعة تصنيفات: حالة الخادم، وحالة الرابط URL، وحالة النماذج، وحالة العميل. تذهب بيانات الخادم إلى مكتبة كاش متخصصة، وتوضع الفلاتر في الرابط، وتظل النماذج محلية، ولا يتبقى لـ Redux أو Zustand سوى الجزء اليسير الخاص بالواجهة."
- "تُستخدم Context API لحقن التبعيات للقيم منخفضة وتيرة التغيير؛ وحيث إنها تُعيد تصيير كافة المستهلكين وتفتقر للمحددات، فإنها لا تناسب إدارة الحالة العامة سريعة التغيير."
- فخ المقابلة: نسخ البيانات المجلوبة من الخادم داخل Redux أو `useState` يُنشئ مصدراً ثانياً للحقيقة يتعرض للتلف والتقادم سريعاً. سؤال متابعة: "كيف تدير هذا التوسع؟" - عبر مصانع لمفاتيح الاستعلام لكل ميزة، وتخصيص `staleTime` لكل نوع بيانات، وإبطال الكاش عبر البادئات، واستخدام التحديثات التفاؤلية (optimistic updates) لتجربة مستخدم فائقة الاستجابة.
- المفاضلة (Trade-off): يمنح Redux معايير وأدوات تطوير قوية مقابل كود مكتبي أكثر؛ بينما يمتاز Zustand بخفة الوزن لكنه يتطلب انضباطاً ذاتياً من الفريق؛ وتُضيف مكتبات الاستعلامات مكتبة تبعية إضافية لكنها تحذف مئات الأسطر اليدوية المخصصة للتحميل والتخزين المؤقت.
