# عدة تبويبات مفتوحة في المتصفح وسجل أحدها الخروج: كيف تعلم بقية التبويبات بذلك؟

**Level:** Mid
**Merged from (original phrasings):**
- عدة تبويبات مفتوحة في المتصفح وقام أحدها بتسجيل الخروج: كيف تعلم التبويبات الأخرى بذلك وتحدث حالتها؟

## The concept
- يمتلك كل تبويب في المتصفح **ذاكرة JavaScript خاصة به تماماً ومستقلة** (حالة React، ومتاجر Redux، والرموز المحفوظة في الذاكرة In-memory tokens). لذلك فإن تسجيل الخروج في التبويب A يمسح حالة A فقط، بينما يستمر التبويب B في عرض البيانات الخاصة ويعامل المستخدم على أنه لا يزال مسجل الدخول ما لم يُبلغه حدث خارجي بغير ذلك.
- **آليات التواصل بين التبويبات لنفس النطاق (Same-origin Cross-tab messaging):**
  - **`BroadcastChannel`**: `new BroadcastChannel('auth').postMessage({ type: 'logout' })`. يستلم هذا الحدث كل تبويب مفتوح يشترك في نفس القناة. وهي ميزة أنيقة ومدعومة في كافة المتصفحات الحديثة.
  - **حدث الـ `storage`**: الكتابة في `localStorage` تطلق حدث `storage` في **التبويبات الأخرى فقط** (ولا تنطلق في التبويب الذي كتب التغيير). وتُعد وسيلة الدعم الاحتياطية الكلاسيكية، وتُستخدم أيضاً لمزامنة "تسجيل الدخول في تبويب آخر". ويجب كتابة طابع زمني (Timestamp) حتى تضمن انطلاق الحدث مع كل عملية متكررة.
- **الخادم هو المصدر النهائي للحقيقة (Single source of truth)**: يجب أن يؤدي تسجيل الخروج إلى **إبطال الجلسة على الخادم فوراً** (حذف الجلسة وإلغاء صلاحية الـ Refresh Token). وبالتالي، فحتى التبويب الذي فاتته الرسالة (كان نائماً أو مجمداً بواسطة نظام تشغيل المتصفح أو غير متصل بالإنترنت) سيستلم **رمز 401 عند أول طلب شبكة تالٍ**، ويتكفل معترض الردود العام (HTTP Interceptor) بمسح الحالة وإعادة التوجيه لصفحة تسجيل الدخول.
- **إعادة التحقق عند التركيز (Re-check on focus)**: عند تحول التبويب إلى الوضع المرئي (`visibilitychange` / `focus`)، يتم التحقق من سريان الجلسة لاصطياد التبويبات التي كانت معلقة.
- وينطبق نفس المبدأ عند **تسجيل الدخول** (تسجيل الدخول بحساب مختلف في تبويب آخر يستدعي تحديث الصفحة) وعند تجديد الرموز (تنسيق تجديد الرمز لمنع تضارب تدوير الـ Refresh Token).

## Real-life example
في تطبيق للخدمات المصرفية عبر الإنترنت، كان المستخدم يستخدم حاسوباً عائلياً مشتركاً، فضغط "تسجيل الخروج" في أحد التبويبات وغادر المكان. وكان هناك تبويب ثانٍ مفتوح على صفحة "الحسابات" يعرض الأرصدة والتحويلات الأخيرة. جلس شخص آخر على الجهاز فرأى كافة البيانات المالية الخاصة أمامه مباشرة! ولأن رمز الوصول كان محفوظاً في ذاكرة ذلك التبويب ولم يلغِ الخروج الجلسة على الخادم، تمكن ذلك الشخص من إرسال حوالة مالية كاملة قبل انتهاء صلاحية الرمز!

```jsx
// LogoutButton.jsx
function LogoutButton() {
  const { setUser, setAccessToken } = useAuth();
  return (
    <button onClick={() => {
      setUser(null);              // يمسح حالة هذا التبويب فقط!
      setAccessToken(null);
      navigate('/login');         // دون استدعاء الخادم: تظل الجلسة صالحة وفعالة!
    }}>
      Log out
    </button>
  );
}

// api.js: تجاهل أخطاء 401، فتظل التبويبات القديمة تعرض بيانات حساسة
export const api = axios.create({ baseURL: '/api', withCredentials: true });
```

## How to fix it
```js
// auth-sync.js: وحدة مركزية لمزامنة أحداث المصادقة عبر التبويبات
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('auth') : null;
const STORAGE_KEY = 'auth:event';

export function broadcastAuth(type) {
  const msg = { type, at: Date.now() };
  channel?.postMessage(msg);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msg)); } catch {} // دعم احتياطي للمتصفحات القديمة
}

export function onAuthEvent(handler) {
  const onMessage = e => handler(e.data);
  const onStorage = e => { if (e.key === STORAGE_KEY && e.newValue) handler(JSON.parse(e.newValue)); };
  channel?.addEventListener('message', onMessage);
  window.addEventListener('storage', onStorage);
  return () => {
    channel?.removeEventListener('message', onMessage);
    window.removeEventListener('storage', onStorage);
  };
}
```

```jsx
// AuthProvider.jsx
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);

  const clearLocalSession = useCallback(() => {
    setUser(null);
    queryClient.clear();                       // مسح الأرصدة والبيانات المالية المخزنة مؤقتاً
    window.location.replace('/login?reason=signed-out'); // توجيه كامل يفرغ كافة البيانات من الذاكرة
  }, [queryClient]);

  // 1. الاستجابة لتسجيل الخروج القادم من التبويبات الأخرى
  useEffect(() => onAuthEvent(msg => { if (msg.type === 'logout') clearLocalSession(); }), [clearLocalSession]);

  // 2. إشعار الخادم بانتهاء الجلسة (للرسائل المفقودة، أو انتهاء الجلسة، أو إبطالها من الإدارة)
  useEffect(() => {
    const id = api.interceptors.response.use(undefined, err => {
      if (err.response?.status === 401) clearLocalSession();
      return Promise.reject(err);
    });
    return () => api.interceptors.response.eject(id);
  }, [clearLocalSession]);

  // 3. التحقق مجدداً بمجرد عودة التبويب للظهور
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') api.get('/session').catch(() => {}); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); }   // على الخادم: حذف الجلسة وإبطال رمز التجديد ومسح الكوكيز
    finally {
      broadcastAuth('logout');                 // بث الحدث لبقية التبويبات فوراً
      clearLocalSession();                     // ومسح حالة هذا التبويب
    }
  }, [clearLocalSession]);

  return <AuthContext.Provider value={{ user, setUser, logout }}>{children}</AuthContext.Provider>;
}
```

```js
// الخادم
app.post('/auth/logout', async (req, res) => {
  await sessions.destroy(req.cookies.sid);           // إبطال الجلسة لكافة التبويبات والأجهزة
  await refreshTokens.revokeFamily(req.user?.id, req.cookies.sid);
  res.clearCookie('sid', { httpOnly: true, secure: true, sameSite: 'lax' });
  res.sendStatus(204);
});
```
سبب نجاح الحل: تستلم التبويبات النشطة المفتوحة رسالة تسجيل الخروج خلال أجزاء من الثانية وتوجه المستخدم لصفحة الدخول فوراً مع تفريغ الكاش المالي. والتبويبات التي كانت نائمة في الخلفية تفشل فور استيقاظها برمز 401 لأن الجلسة أُبطلت على الخادم، فيقوم معترض الردود بطردها فوراً.

## How to say it in the interview
- "التبويبات لا تتشارك الذاكرة، لذا أبث حدث الخروج عبر BroadcastChannel مع الاعتماد على حدث الـ `storage` كحل احتياطي. ولكن الضمان الأمني الحقيقي والنهائي يكمن في إبطال الجلسة على الخادم، حتى ينال أي تبويب معلق رمز 401 فوراً ويُطرد للخارج."
- "أتعامل مع الحالات العكسية أيضاً: مثل تسجيل الدخول بحساب مختلف في تبويب آخر، وتنسيق عملية تجديد الرموز حتى لا تتسابق التبويبات وتكسر آلية تدوير الـ Refresh Token."
- فخ شائع: حدث الـ `storage` لا ينطلق في التبويب الذي كتب البيانات، وينطلق فقط إذا تغيرت القيمة فعلياً، لذا يجب تضمين طابع زمني (Timestamp). كما أن `sessionStorage` معزولة لكل تبويب ولا يمكن استخدامها للمزامنة المشتركة.
- الموازنة (Trade-off): إعادة التوجيه الصارم (`location.replace`) حاسم وقاطع ويضمن عدم بقاء أي بيانات حساسة في الذاكرة، بينما التنقل الناعم (Soft navigation عبر الموجه الداخلي) أكثر سلاسة لكنه قد يخاطر ببقاء بعض الحالات القديمة في الذاكرة.
