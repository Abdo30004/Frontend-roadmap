# كيف تستخدم الـ Context API لإدارة الحالة العامة، ولماذا يُعيد أي تحديث تصيير كافة المستهلكين؟

**Level:** Mid
**Merged from (original phrasings):**
- كيف تطبق الـ Context API لإدارة الحالة العامة (Global State Management)؟
- لماذا يؤدي تحديث واحد في الـ Context إلى إعادة تصيير كافة المستهلكين (Consumers)؟ وكيف تعالج ذلك؟

## The concept
- تُستخدم الـ Context لتمرير البيانات عبر شجرة المكونات دون الحاجة لتمرير الخصائص يدوياً عبر كل مستوى (Prop Drilling): إنشاء السياق عبر `createContext` -> ثم التغليف بـ `<Ctx value={...}>` (في React 19؛ أو `<Ctx.Provider>` في الإصدارات الأقدم) -> ثم الاستهلاك عبر `useContext(Ctx)` أو دالة `use(Ctx)`.
- الـ Context هي **آلية لحقن الاعتماديات (Dependency Injection)، وليست أداة متكاملة لإدارة الحالة (State Manager)**. وعادة ما تُدمج مع `useState` أو `useReducer` داخل مكون موفر (Provider).
- عندما تتغير قيمة الـ `value` في الـ Provider (وفق مقارنة `Object.is`)، **يُعاد تصيير كل مكون يقرأ ذلك الـ Context تلقائياً**، حتى لو كان يستخدم حقلاً واحداً فقط لم يطرأ عليه أي تغيير! لا توجد محددات (Selectors) مدمجة، كما أن تغليف المكون بـ `memo` لا يمنع إعادة تصييره الناتجة عن الـ Context.
- أكثر سببين شيوعاً لعمليات إعادة التصيير الفائضة:
  1. تمرير قيمة الـ value كـ **كائن جديد في كل تصيير** (مثل `value={{ user, setUser }}`)، مما يعيد تصيير جميع المستهلكين كلما أعيد تصيير المكون الأب للـ Provider.
  2. **وضع كل شيء في Context واحد عملاق** يحتوي على بيانات سريعة التغير وغير مرتبطة ببعضها (سلة المشتريات + بيانات المستخدم + المظهر Theme + الإشعارات).
- الحلول: تحفيظ القيمة عبر `useMemo`، و**تقسيم الـ Contexts** حسب معدل تكرار التغيير، و**فصل البيانات (State) عن الدوال (Actions)** (فدوال dispatch و setters مستقرة ولا تتغير مراجعها)، وإبقاء الـ Providers قريبة من المكونات التي تحتاجها. وللحالات العامة المعقدة سريعة التحديث، استخدم مكتبة تدعم الـ Selectors (مثل **Zustand** أو Redux Toolkit أو Jotai) أو استخدم `useSyncExternalStore`.
- الاستخدامات المثالية للـ Context: المظهر (Theme)، واللغة (Locale)، والمستخدم الحالي، وأعلام الميزات (Feature flags)؛ أي البيانات نادرة التغير.

## Real-life example
تطبيق ويب لتوصيل الطعام يضع كل شيء في `AppContext` واحد: بيانات المستخدم، وسلة المشتريات، والمظهر، والوقت التقديري لوصول السائق (ETA) الذي يتحدث كل ثانية. في صفحة المطعم التي تحتوي على 200 صنف، يقرأ كل عنصر قائمة الـ Context فقط ليعرف هل المستخدم مسجل الدخول أم لا. تفاجأ المستخدمون بتقطع الشاشة كل ثانية وبطء شديد في التمرير على الهواتف المتوسطة. وأظهر فحص الـ Profiler أن كافة عناصر القائمة الـ 200 (`MenuItem`) يُعاد تصييرها بالكامل مرة كل ثانية!

```jsx
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);
  const [eta, setEta] = useState(null);

  useEffect(() => {
    const id = setInterval(async () => setEta(await fetchEta()), 1000);
    return () => clearInterval(id);
  }, []);

  const addToCart = (item) => setCart((c) => [...c, item]);

  return (
    <AppContext.Provider value={{ user, setUser, cart, addToCart, eta }}>
      {children}
    </AppContext.Provider>
  );
}

const MenuItem = memo(function MenuItem({ dish }) {
  const { user, addToCart } = useContext(AppContext); // يُعاد تصييره مع كل تحديث لمؤقت ETA!
  return <button disabled={!user} onClick={() => addToCart(dish)}>{dish.name}</button>;
});
```

## How to fix it
قم بتقسيم الـ Context حسب وتيرة التحديث، وافصل دوال الإجراءات المستقرة عن البيانات المتغيرة.

```jsx
const UserContext = createContext(null);
const CartStateContext = createContext([]);
const CartActionsContext = createContext(null);
const EtaContext = createContext(null);

export function AppProviders({ children }) {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);

  const userValue = useMemo(() => ({ user, setUser }), [user]);
  const cartActions = useMemo(() => ({
    add: (item) => setCart((c) => [...c, item]),
    remove: (id) => setCart((c) => c.filter((i) => i.id !== id)),
  }), []); // دوال التحديث مستقرة، لذا لا يتغير مرجع هذا الكائن إطلاقاً

  return (
    <UserContext value={userValue}>
      <CartActionsContext value={cartActions}>
        <CartStateContext value={cart}>
          <EtaProvider>{children}</EtaProvider>
        </CartStateContext>
      </CartActionsContext>
    </UserContext>
  );
}

function EtaProvider({ children }) {
  const [eta, setEta] = useState(null); // عزل الحالة سريعة التغير في مزودها الخاص
  useEffect(() => {
    const id = setInterval(async () => setEta(await fetchEta()), 1000);
    return () => clearInterval(id);
  }, []);
  return <EtaContext value={eta}>{children}</EtaContext>;
}

// توفر الخطافات المخصصة واجهة استخدام واضحة ورسائل خطأ مفيدة
export function useCartActions() {
  const ctx = useContext(CartActionsContext);
  if (!ctx) throw new Error('useCartActions must be used inside AppProviders');
  return ctx;
}

const MenuItem = memo(function MenuItem({ dish }) {
  const { user } = useContext(UserContext);   // يتغير فقط عند تسجيل الدخول أو الخروج
  const { add } = useCartActions();            // ثابت لا يتغير مرجعه أبداً
  return <button disabled={!user} onClick={() => add(dish)}>{dish.name}</button>;
});
```
سبب نجاح الحل: تحديث مؤقت الـ ETA يغير `EtaContext` فقط، والذي لا يقرأه سوى شريط إشعار السائق. وبما أن `children` أُنشئت في مستوى أعلى، فإن إعادة تصيير `EtaProvider` لا تعيد تصيير القائمة. كما أن إضافة صنف للسلة يغير `CartStateContext`، بينما تقرأ عناصر القائمة `CartActionsContext` المستقر، فلا تتأثر. يُعاد تصيير كل مستهلك فقط عند تغير البيانات التي تهمه بالفعل.

حل بديل للحالات المعقدة سريعة التحديث: متجر Zustand مع الـ Selectors يعيد تصيير المكونات فقط عندما تتغير الشريحة المحددة:
```js
const user = useAppStore((s) => s.user);
const add = useAppStore((s) => s.addToCart);
```

## How to say it in the interview
- "الـ Context وسيلة لتمرير القيم وليست متجراً للحالة. فعندما تتغير القيمة، يُعاد تصيير كافة المستهلكين تلقائياً لغياب الـ Selectors، ولا يمنع `memo` ذلك."
- "أحل ذلك بتحفيظ قيمة الـ value عبر `useMemo`، وتقسيم الـ Contexts حسب تكرار التحديث، ووضع الإجراءات (Actions) في Context منفصل. وللحالات سريعة التحديث وعالية التردد أستخدم مكتبات تدعم الـ Selectors مثل Zustand أو Redux."
- فخ شائع: كتابة `value={{ a, b }}` مباشرة في كود الـ JSX؛ هذا ينشئ كائناً جديداً في الذاكرة مع كل تصيير للـ Provider، مما يعيد تصيير جميع المستهلكين حتى لو لم تتغير `a` أو `b`.
- الموازنة (Trade-off): إنشاء العديد من الـ Contexts الصغيرة يزيد من عدد الـ Providers وكود البنية الأساسية. واستخدام متجر خارجي يضيف اعتمادية خارجية ولكنه يمنح اشتراكات دقيقة ومحكمة الأداء (Fine-grained subscriptions).
