# المعالجة المركزية للأخطاء وتحديث التوكن ومنطق إعادة المحاولة عند فشل طلبات الـ API المتزامنة

**Level:** Senior
**Merged from (original phrasings):**
- كيف تتعامل مع حالات الفشل المتزامنة للـ API باستخدام معالجة أخطاء مركزية ومنطق إعادة المحاولة (Retry Logic)؟

## The concept (short answer)

- **عميل HTTP واحد، ومكان مركزي للسياسات المشتركة:** استخدام كائن axios واحد مزود باعتراضات (interceptors) (أو مغلف fetch مخصص) لإدارة ترويسات المصادقة (auth headers)، وتحديث التوكن (token refresh)، وإعادة المحاولة (retries)، وتوحيد صيغة الأخطاء (error normalization)، وتسجيل السجلات (logging). لا ينبغي للمكونات أبداً إعادة تنفيذ هذا المنطق يدوياً.
- **تحديث التوكن عبر مسار طيران واحد (Single-flight token refresh):** عند انتهاء صلاحية access token، تستقبل 10 طلبات متزامنة رمز الخطأ `401`. يجب تنفيذ استدعاء تحديث **واحد فقط**؛ بينما تنتظر بقية الطلبات نفس الوعد (promise)، ثم تُعيد إرسال طلباتها بالتوكن الجديد فور استلامه. بدون هذه الآلية، يؤدي تدوير التوكن (refresh token rotation) إلى فشل 9 من أصل 10 استدعاءات ويتم تسجيل خروج المستخدم قسراً.
- **إعادة محاولة ما هو آمن فقط:** إعادة المحاولة مخصصة فقط للأعطال العابرة (أخطاء الشبكة، والرموز `408` و `429` و `502/503/504`) وفقط للطلبات **محايدة التأثير (Idempotent)** (مثل `GET` و `PUT` و `DELETE`، أو طلبات `POST` المزودة بترويسة `Idempotency-Key`). لا تُعد المحاولة أبداً مع الرموز `400/401/403/404/422` - لأنها ستفشل مجدداً حتماً.
- **التراجع الأسي مع التذبذب العشوائي (Exponential backoff + jitter):** حساب فترة الانتظار كالتالي: `delay = random(0, base * 2^attempt)` ("full jitter") حتى لا تُعيد آلاف المتصفحات المحاولة في نفس اللحظة وتُسقط الخادم المتعافي بهجوم حجب خدمة غير مقصود (DDoS). التزم بترويسة `Retry-After` دائماً، وضع حداً أقصى للمحاولات.
- **توحيد صيغ الأخطاء** في كائن قياسي (`{ kind, status, message, retryable }`) وتوجيهها: معالجة **عامة (Global)** للأخطاء المشتركة (شريط انقطاع الإنترنت، انتهاء الجلسة -> التحويل لصفحة تسجيل الدخول، رسالة toast واحدة مدمجة لأخطاء 5xx)، ومعالجة **محلية (Local)** للأخطاء التي يمكن للمكون شرحها للمستخدم (رسائل التحقق بجانب الحقول، صفحة "غير موجود"، زر إعادة المحاولة داخل الودجت).

## Real-life example: the problem

لوحة تحكم بنكية تُحمّل الحسابات والبطاقات والمعاملات والإشعارات والحدود الائتمانية بالتوازي. بعد 15 دقيقة من الخمول تنتهي صلاحية access token. يضغط المستخدم على "تحديث": تستقبل 6 طلبات رمز `401`، فيُطلق المعترض ستة استدعاءات لتحديث التوكن، فيقوم الـ Backend بتدوير الـ refresh token في الطلب الأول ويعتبر الطلبات الخمسة التالية محاولة احتيالية لإعادة استخدام توكن ملغى - فيبطل الجلسة بالكامل. يُطرد المستخدم فجأة أثناء عمله. وفي حادثة أخرى، حدث خطأ عابر `503` أثناء عملية "تحويل أموال"، فأُعيد الطلب تلقائياً وتم تنفيذ التحويل **مرتين**. وظهرت على الشاشة 6 رسائل toast حمراء متطابقة كُتب عليها "Something went wrong".

```js
const api = axios.create({ baseURL: '/api' });

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error.config;
    if (error.response?.status === 401) {
      // Every failing request starts its own refresh
      const { data } = await axios.post('/api/auth/refresh');
      tokenStore.set(data.accessToken);
      config.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(config);
    }
    // Retries everything, including POST /transfers, immediately and forever
    if (!error.response || error.response.status >= 500) {
      return api(config);
    }
    toast.error('Something went wrong');   // one toast per failed request
    throw error;
  }
);
```

## How to fix it

```js
const api = axios.create({ baseURL: '/api', timeout: 15_000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- single-flight refresh: all concurrent 401s share one promise
let refreshPromise = null;
function refreshAccessToken() {
  refreshPromise ??= axios                       // plain axios: no interceptors, no recursion
    .post('/api/auth/refresh', null, { withCredentials: true })
    .then(({ data }) => { tokenStore.set(data.accessToken); return data.accessToken; })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

const IDEMPOTENT = new Set(['get', 'head', 'options', 'put', 'delete']);
const RETRYABLE_STATUS = new Set([408, 429, 502, 503, 504]);
const MAX_RETRIES = 3;

api.interceptors.response.use(undefined, async (error) => {
  const config = error.config;
  const status = error.response?.status;
  if (!config || axios.isCancel(error)) throw error;

  if (status === 401 && !config._authRetried) {
    config._authRetried = true;
    try {
      const token = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return api(config);                          // replay original request once
    } catch (refreshError) {
      authEvents.emit('session-expired');          // global: redirect to login once
      throw normalizeError(refreshError);
    }
  }

  const safeToRetry = IDEMPOTENT.has(config.method) || config.headers['Idempotency-Key'];
  const transient = !error.response || RETRYABLE_STATUS.has(status);
  config._retryCount ??= 0;

  if (safeToRetry && transient && config._retryCount < MAX_RETRIES) {
    config._retryCount += 1;
    const retryAfter = Number(error.response?.headers?.['retry-after']) * 1000;
    const backoff = Math.random() * Math.min(10_000, 300 * 2 ** config._retryCount); // full jitter
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : backoff);
    return api(config);
  }

  const normalized = normalizeError(error);
  if (normalized.kind === 'server' || normalized.kind === 'network') {
    notify.global(normalized);                     // deduplicated by kind within a time window
  }
  throw normalized;                                // callers handle 4xx locally
});

function normalizeError(error) {
  const status = error.response?.status;
  if (!error.response) return { kind: 'network', status: 0, message: 'You appear to be offline.', retryable: true };
  if (status >= 500) return { kind: 'server', status, message: 'Service temporarily unavailable.', retryable: true };
  return { kind: 'client', status, message: error.response.data?.message ?? 'Request failed.', fieldErrors: error.response.data?.errors, retryable: false };
}
```

تحصل عمليات التعديل (mutations) التي تتطلب أماناً عند إعادة المحاولة على مفتاح Idempotency يُنشأ مرة واحدة لكل نية مستخدم:

```js
const key = crypto.randomUUID();                 // created when the user clicks "Send", reused on retries
api.post('/transfers', payload, { headers: { 'Idempotency-Key': key } });
```

لماذا ينجح هذا الحل: يدمج وعد `refreshPromise` المشترك N من أخطاء 401 المتزامنة في استدعاء تجديد واحد فقط، وتنتظره بقية الطلبات ثم تُعاد؛ وتمنع علامة `_authRetried` الدخول في حلقات 401 لا نهائية. تقتصر إعادة المحاولة على الأخطاء المؤقتة للطلبات الآمنة فقط، مع تباعد زمني عشوائي (jittered backoff) لمنع إغراق الخوادم وضمان عدم إرسال الأموال مرتين بفضل مفتاح الـ idempotency. تصل الأخطاء إلى المكونات في شكل قياسي متوقع، وتُعرض المشكلات العامة مرة واحدة، وتبقى رسائل التحقق محلية داخل حقولها. البدائل: تجديد التوكن استباقياً قبل انتهاء صلاحيته لتجنب معظم أخطاء 401؛ وفي TanStack Query حدد خيار `retry` لكل استعلام واستخدم معالج `onError` داخل `QueryCache` لعرض إشعارات الـ toasts العامة.

## How to say it in the interview

- "عميل HTTP مركزي مزود باعتراضات (interceptors) يتولى المصادقة وإعادة المحاولة وتوحيد الأخطاء. تمر أخطاء 401 المتزامنة عبر وعد تجديد واحد مشترك (single-flight promise)، ثم يُعاد تشغيل الطلبات الأصلية مرة واحدة بالتوكن الجديد."
- "أعيد محاولة الأخطاء العابرة فقط على الطلبات محايدة التأثير (Idempotent)، مع استخدام exponential backoff مع jitter واحترام ترويسة `Retry-After`؛ أما العمليات غير محايدة التأثير فتحتاج لمفتاح idempotency أو لا يُعاد إرسالها إطلاقاً."
- فخ المقابلة: وقوع استدعاء تجديد التوكن نفسه داخل نفس المعترض (حلقة لا نهائية)، أو إعادة محاولة `POST /payments` دون مفتاح تحييد. سؤال متابعة: تطبيق قاطع الدائرة (Circuit Breaker) - التوقف عن المحاولات بعد تكرار الفشل وعرض نمط تشغيلي مخفض (degraded mode).
- المفاضلة (Trade-off): تُعزز إعادات المحاولة المتانة والموثوقية لكنها تزيد زمن الاستجابة وحمل الخوادم؛ كما أن التنبيهات العامة موحدة لكنها تفتقر للتخصيص، لذلك يجب دائماً تصيير الأخطاء الخاصة بكل مكون محلياً (باستخدام error boundaries لكل ودجت).
