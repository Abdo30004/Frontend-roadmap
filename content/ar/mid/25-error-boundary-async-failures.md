# لماذا لا تلتقط الـ Error Boundary الأخطاء غير المتزامنة (Async Errors)؟

**Level:** Mid
**Merged from (original phrasings):**
- لماذا لا تلتقط الـ Error Boundary في React الأخطاء غير المتزامنة (Async Failures)؟

## The concept
- الـ **Error Boundary** هو مكون فئوي (Class Component) يعتمد على `getDerivedStateFromError` أو `componentDidCatch`. ويلتقط React الأخطاء فقط عندما تحدث **أثناء استدعائه لكودك في مرحلة التصيير (Rendering Phase)**: دوال render، ودوال دورة الحياة (Lifecycles)، ودوال البناء (Constructors)، وجسم الـ Effects التزامني.
- الأخطاء التي تقع **خارج مسار استدعاء التصيير (Outside the render call stack)** لا يلتقطها React نهائياً:
  - **معالجات الأحداث (Event Handlers)** كـ `onClick`: يستدعيها React كاستجابة لنقر المستخدم، وليست جزءاً من عملية بناء الـ DOM، وتظل الشاشة متسقة، لذا يترك React معالجة أخطائها لك.
  - **الأكواد غير المتزامنة (Async Code)**: سلاسل `fetch().then`، والدوال غير المتزامنة بعد كلمة `await`، ومؤقتات `setTimeout` و `setInterval`، ومعالجات الـ WebSocket. فعندما ترمي هذه الأكواد خطأ، يكون مكدس استدعاء التصيير قد انتهى وتفرغ تماماً، فيتحول الخطأ إلى Unhandled Promise Rejection أو خطأ عام في النافذة.
  - أخطاء التصيير على الخادم (SSR) والأخطاء التي تحدث داخل مكون الـ Boundary نفسه.
- **الحلول التقنية:**
  - التقاط الخطأ غير المتزامن و**نقله إلى مرحلة التصيير**: عبر `setState(() => { throw error; })`؛ فدالة التحديث تُنفذ أثناء التصيير التالي فيلتقطها الـ Boundary فوراً.
  - استخدام مكتبة **`react-error-boundary`**: يوفر خطاف `useErrorBoundary()` دالة `showBoundary(error)` التي تطبق هذه الحيلة تلقائياً مع دعم إعادة المحاولة وإعادة ضبط المفاتيح (`resetKeys`).
  - **جلب البيانات المعتمد على Suspense** (مثل دالة `use(promise)` في React 19، أو نمط `useSuspenseQuery` في React Query، أو Server Components): حيث تُرمى الـ Promise المرفوضة مباشرة أثناء مرحلة التصيير فيلتقطها الـ Boundary تلقائياً.
  - في Next.js App Router: ملف `error.js` لكل مسار يمثل Error Boundary مدمج وجاهز.
- واحرص دوماً على وضع مستمع عام `window.addEventListener('unhandledrejection', ...)` أو أداة Sentry لالتقاط ما قد يفلت من الـ Boundaries.

## Real-life example
في بوابة طبية للمرضى، تم تغليف عنصر "نتائج الفحوصات المخبرية" داخل Error Boundary حتى لا يتسبب أي عطل فيه في إسقاط لوحة التحكم بالكامل. عندما بدأت واجهة المختبر البرمجية بإرجاع كود غير صالح (HTML بدلاً من JSON)، لم تعرض الـ Boundary واجهتها البديلة ("تعذر تحميل النتائج، أعد المحاولة") إطلاقاً! وبدلاً من ذلك، تجمد العنصر على مؤشر تحميل لا نهائي، وظهر في الكونسول: `Uncaught (in promise) SyntaxError: Unexpected token '<'`، وظن المرضى أن فحوصاتهم لا تزال قيد التحضير. كما فشل النقر على "تحميل التقرير PDF" بصمت تام لانتهاء صلاحية الجلسة.

```jsx
<ErrorBoundary fallback={<WidgetError />}>
  <LabResults patientId={id} />
</ErrorBoundary>

function LabResults({ patientId }) {
  const [results, setResults] = useState(null);

  useEffect(() => {
    fetch(`/api/patients/${patientId}/labs`)
      .then(r => r.json())                 // خطأ غير متزامن SyntaxError: لا تلتقطه الـ Error Boundary!
      .then(setResults);
  }, [patientId]);

  async function downloadPdf() {
    const res = await fetch(`/api/patients/${patientId}/labs.pdf`);
    if (!res.ok) throw new Error('Download failed'); // معالج أحداث غير متزامن: لا تلتقطه الـ Boundary
    saveBlob(await res.blob());
  }

  if (!results) return <Spinner />;        // يظل معلقاً للأبد
  return <ResultsTable results={results} onDownload={downloadPdf} />;
}
```

## How to fix it
**الخيار الأول: استخدام `react-error-boundary` مع `showBoundary`:**
```jsx
import { ErrorBoundary, useErrorBoundary } from 'react-error-boundary';

function LabResults({ patientId }) {
  const [results, setResults] = useState(null);
  const { showBoundary } = useErrorBoundary();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/patients/${patientId}/labs`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`Labs API ${r.status}`); return r.json(); })
      .then(setResults)
      .catch(err => { if (err.name !== 'AbortError') showBoundary(err); }); // نقل الخطأ لمرحلة التصيير
    return () => controller.abort();
  }, [patientId, showBoundary]);

  async function downloadPdf() {
    try {
      const res = await fetch(`/api/patients/${patientId}/labs.pdf`);
      if (!res.ok) throw new Error('فشل التحميل');
      saveBlob(await res.blob());
    } catch (err) {
      toast.error('تعذر تحميل الملف، يرجى المحاولة مجدداً'); // خطأ محلي يُعالج بإشعار بسيط دون كسر العنصر
    }
  }

  if (!results) return <Spinner />;
  return <ResultsTable results={results} onDownload={downloadPdf} />;
}

// الاستخدام مع دعم إعادة المحاولة وتصفير الحالة عند تغير المريض
<ErrorBoundary
  FallbackComponent={({ error, resetErrorBoundary }) => (
    <WidgetError message="تعذر تحميل نتائج الفحوصات المخبرية." onRetry={resetErrorBoundary} />
  )}
  onError={(error) => reportToSentry(error)}
  resetKeys={[id]}
>
  <LabResults patientId={id} />
</ErrorBoundary>
```

**الخيار الثاني: الاعتماد على Suspense مع دالة `use` (في React 19) لرمي الأخطاء أثناء التصيير طبيعياً:**
```jsx
function LabResults({ labsPromise }) {
  const results = use(labsPromise);   // يُرمى الخطأ أثناء التصيير مباشرة فتلتقطه الـ Boundary فوراً
  return <ResultsTable results={results} />;
}

<ErrorBoundary FallbackComponent={LabsError}>
  <Suspense fallback={<Spinner />}>
    <LabResults labsPromise={labsPromise} />
  </Suspense>
</ErrorBoundary>
```

## How to say it in the interview
- "تلتقط الـ Error Boundaries الأخطاء التي تحدث أثناء مرحلة التصيير فقط. أما معالجات الأحداث والعمليات غير المتزامنة فتعمل لاحقاً خارج مكدس استدعاء تصيير React، فلا يصل الخطأ للـ Boundary بل يتحول إلى Unhandled Rejection."
- "لتوجيه خطأ غير متزامن إلى الـ Boundary أعيد رميه أثناء التصيير: إما عبر `showBoundary` من مكتبة react-error-boundary، أو عبر دالة تحديث حالة ترمي الخطأ، أو باستخدام Suspense مع دالة `use()` أو `useSuspenseQuery`."
- فخ شائع: وضع `try/catch` فارغة حول `await` دون أي معالجة؛ فهذا يترك واجهة المستخدم معلقة على مؤشر دوران للأبد. يجب أن يمتلك كل مسار غير متزامن إما حالة خطأ واضحة أو توجيهاً للـ Boundary.
- الموازنة (Trade-off): ليس كل خطأ يستدعي استبدال واجهة العنصر بالكامل؛ فالأخطاء القابلة للاستدراك (مثل فشل تحميل ملف أو حفظ حقل) يُفضل التعامل معها بإشعارات سريعة (Toasts)، بينما تُترك الـ Boundaries لأخطاء البيانات الجوهرية التي تمنع عرض القسم بالكامل.
