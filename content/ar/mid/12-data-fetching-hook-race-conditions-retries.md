# كيف تبني Hook مخصصاً لجلب البيانات مع دعم الإلغاء، وإعادة المحاولة، ومعالجة الأخطاء، ومنع الـ Race Conditions؟

**Level:** Mid
**Merged from (original phrasings):**
- كيف تدير استدعاءات الـ API ومعالجة الأخطاء في React؟
- كيف تبني Custom Hook لجلب البيانات يدعم الإلغاء (Cancellation) وإعادة المحاولة (Retries) ومعالجة الأخطاء؟
- كيف تمنع حدوث سباق الطلبات (Race Conditions) عند جلب البيانات داخل الـ Effects؟

## The concept
- تحدث مشكلة **سباق الطلبات (Race Condition)** عندما يبدأ الطلب A، ثم يبدأ الطلب B (لتغيير المستخدم لفلتر البحث مثلاً)، ولكن **الطلب A ينتهي بعد B**. فتستبدل بيانات A القديمة بيانات B الحديثة، وتعرض الواجهة نتائج خاطئة لا تطابق ما هو مكتوب في خانة البحث.
- أداتان أساسيتان داخل دالة تنظيف الـ Effect (Cleanup):
  - **`AbortController`**: تلغي طلب الشبكة نفسه (لتوفير استهلاك البيانات؛ وترمي دالة `fetch` خطأ من نوع `AbortError`).
  - **متغير الراية `ignore` (Ignore flag)**: `let ignore = false; return () => { ignore = true }`. في حال وصول الرد متأخراً، يُتجاهل تماماً ولا يُكتب في الـ State. يعمل هذا النمط مع أي Promise (حتى مع مكتبات SDKs أو عملاء GraphQL التي لا تدعم الإلغاء الصريح).
- **معالجة الأخطاء (Error Handling)**: لا ترمي دالة `fetch` خطأ عند استلام رموز HTTP 404 أو 500، لذلك يجب فحص `res.ok` دائماً. وافصل الحالات بوضوح: `loading`، و `error`، و `data`. واعرض زر إعادة المحاولة مع الإبقاء على البيانات القديمة متى ما كان ذلك مناسباً لتجربة المستخدم.
- **إعادة المحاولة (Retries)**: تُطبق فقط على الأخطاء المؤقتة والعابرة (أخطاء انقطاع الشبكة، أخطاء الخادم 5xx، ورمز تجاوز المعدل 429)، ولا تُطبق أبداً على أخطاء التحقق 4xx. واستخدم استراتيجية **التراجع الأسي مع التشتت العشوائي (Exponential backoff with jitter)** مع تحديد سقف أقصى لعدد المحاولات، والالتزام بهيدر `Retry-After`.
- الحل الإنتاجي المعتمد: **TanStack Query** (أو SWR، أو الجلب المباشر في React Server Components)؛ فهي تتكفل بالتخزين المؤقت (Caching)، ومنع تكرار الطلبات، والإلغاء، وإعادة المحاولة، والجلب عند التركيز، وسياسة stale-while-revalidate. وبناء خطاف مخصص ممتاز لإثبات فهمك للآليات الداخلية في المقابلات.

## Real-life example
في صفحة حجز تذاكر الطيران، يكتب المستخدم "Par"، ثم يكمل بسرعة ليصبح النص "Paris". كان طلب البحث عن "Par" بطيئاً لكبر حجم النتائج، فوصل بعد رد "Paris". ظهرت في القائمة مطارات تابعة لـ "Par" (مثل Parma و Paro) أسفل خانة كتب فيها "Paris"! وعندما أعاد الخادم خطأ 500، عرضت الصفحة "undefined" لأن `fetch` لم ترمِ استثناءً، وتسبب انقطاع لحظي لشبكة Wi-Fi في بقاء الصفحة فارغة ومعلقة إلى الأبد.

```jsx
function useAirports(query) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/airports?q=${query}`)
      .then((res) => res.json())       // خطأ 500 يتم تحليله كبيانات عادية!
      .then((json) => {
        setData(json.items);           // خطأ: الرد الأقدم قد يصل متأخراً ويستبدل الرد الأحدث
        setLoading(false);
      });                              // غياب catch: انقطاع الشبكة يبقي التحميل معلقاً للأبد
  }, [query]);

  return { data, loading };
}
```

## How to fix it
```js
import { useCallback, useEffect, useState } from 'react';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });
  });

const isRetryable = (err) =>
  err.name === 'TypeError' ||                                    // خطأ في الشبكة
  (err instanceof HttpError && (err.status >= 500 || err.status === 429));

async function fetchJson(url, { signal, retries = 3, baseDelay = 500 }) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new HttpError(res.status, `فشل الطلب برمز: ${res.status}`);
      return await res.json();
    } catch (err) {
      if (signal.aborted || attempt >= retries || !isRetryable(err)) throw err;
      const delay = baseDelay * 2 ** attempt + Math.random() * 200; // تراجع أسي + تشتت عشوائي
      await sleep(delay, signal);
    }
  }
}

export function useApi(url) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let ignore = false;

    setState((s) => ({ ...s, status: 'loading', error: null })); // الاحتفاظ بالبيانات القديمة أثناء التحميل

    fetchJson(url, { signal: controller.signal })
      .then((data) => { if (!ignore) setState({ status: 'success', data, error: null }); })
      .catch((error) => {
        if (ignore || error.name === 'AbortError') return;
        setState((s) => ({ ...s, status: 'error', error }));
      });

    return () => {
      ignore = true;        // منع كتابة أي رد قديم في الحالة
      controller.abort();   // إلغاء الطلب على مستوى بطاقة الشبكة
    };
  }, [url, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);
  return { ...state, retry };
}

// الاستخدام في المكون
function AirportSearch({ query }) {
  const { status, data, error, retry } = useApi(
    query ? `/api/airports?q=${encodeURIComponent(query)}` : null
  );
  if (status === 'error') return <ErrorBox message={error.message} onRetry={retry} />;
  return <AirportList items={data?.items ?? []} loading={status === 'loading'} />;
}
```
سبب نجاح الحل: كل دورة تشغيل للـ Effect تمتلك كائن `AbortController` خاصاً بها وراية `ignore` مستقلة. فعند تغير `query`، تلغي دالة التنظيف الطلب القديم وتضبط راية التجاهل قبل بدء الطلب الجديد، فلا يُسمح إلا للرد الأحدث بتحديث الـ State. ويحول فحص `res.ok` أخطاء الـ HTTP إلى استثناءات حقيقية، مع إعادة المحاولة التلقائية للأخطاء العابرة وتوفير زر إعادة محاولة يدوي للمستخدم.

### الحل في بيئة الإنتاج الحقيقية
```jsx
const { data, error, isPending, refetch } = useQuery({
  queryKey: ['airports', query],
  queryFn: ({ signal }) => fetchJson(`/api/airports?q=${encodeURIComponent(query)}`, { signal, retries: 0 }),
  enabled: query.length > 1,
  retry: 3,                // دعم مدمج للتراجع الأسي
  staleTime: 60_000,
});
```
تُخزن النتائج تلقائياً حسب مفتاح الاستعلام (`queryKey`). وبالتالي فإن كتابة "Paris" ثم العودة لـ "Par" ثم "Paris" تعرض النتائج فوراً من الذاكرة المؤقتة، وتستحيل مشكلة الـ Race Conditions لأن البيانات مخزنة بحسب مفاتيحها الفريدة.

## How to say it in the interview
- "جلب البيانات داخل الـ Effect يستلزم دائماً دالة تنظيف (Cleanup): استخدام `AbortController` لإلغاء طلب الشبكة وراية `ignore` لضمان ألا يستبدل أي رد متأخر الحالة الأحدث."
- "دالة `fetch` لا تفشل إلا عند انقطاع الشبكة، لذا أتحقق دوماً من `res.ok`. وأعيد المحاولة فقط في الأخطاء العابرة (الشبكة، 5xx، 429) مع تراجع أسي وتشتت عشوائي (Jitter)."
- "في التطبيقات الإنتاجية أعتمد على TanStack Query أو أجلب البيانات في Server Components؛ لأن محاولة كتابة Custom Hook كامل تنتهي عادة بإعادة اختراع التخزين المؤقت وحذف التكرار بشكل ناقص."
- الموازنة (Trade-off): إعادة المحاولة تحمي المستخدم من الانقطاعات اللحظية ولكنها تزيد الحمل على الخوادم المتعثرة. لذا فإن استخدام الـ Jitter ووضع حد أقصى للمحاولات يمنعان انهيار الخادم (Thundering Herd). وإياك أن تعيد محاولة طلبات غير حيادية التأثير (Non-idempotent) مثل `POST /payments` دون إرفاق Idempotency Key فريد.
