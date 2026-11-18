# واجهة الـ API تستغرق 5 ثوانٍ للاستجابة: ماذا يرى المستخدم في هذه الأثناء؟

**Level:** Mid
**Merged from (original phrasings):**
- واجهة الـ API تستغرق 5 ثوانٍ للرد: ماذا يرى المستخدم خلال هذا الوقت، وكيف تصمم تجربة الانتظار؟

## The concept
- **لا تعرض شاشة بيضاء فارغة ولا واجهة متجمدة أبداً**: اعرض عناصر الواجهة فوراً، وأوضح حالة التقدم، وأبقِ بقية أجزاء الصفحة قابلة للاستخدام.
- **هياكل التحميل التمهيدية (Skeleton Screens)**: صمم هياكل تطابق أبعاد وتخطيط المحتوى النهائي، بدلاً من وضع مؤشر دوران (Spinner) يغطي كامل الصفحة؛ فهذا يحسن السرعة الإدراكية (Perceived speed) ويمنع انزياح التخطيط التراكمي (CLS) عند وصول البيانات.
- **عرض البيانات القديمة أولاً (Stale-While-Revalidate)**: خزن الردود السابقة مؤقتاً (عبر `staleTime` في React Query أو SWR) واعرضها فوراً للمستخدم أثناء جلب البيانات الحديثة في الخلفية، مع مؤشر خفيف يفيد بـ "جارٍ التحديث...".
- **التصيير التدريجي والمتدفق (Streamed Rendering)**: لا تحجب الصفحة بأكملها بانتظار أبطأ استدعاء؛ بل ضع لكل قسم حدود Suspense أو حالة تحميل مستقلة، واستخدم تقنية الـ Streaming في Next.js لإرسال الإطار العام أولاً.
- **الواجهات المتفائلة (Optimistic UI) لعمليات التعديل**: حدّث الواجهة فوراً عند النقر وتراجع عنها فقط في حال حدوث خطأ من الخادم (مثل الإعجابات، وأزرار التبديل، والإضافة للسلة).
- **التغذية الراجعة المتصاعدة (Escalating Feedback)**: تأخير ظهور مؤشر التحميل ~300ms (لتفادي الوميض في الردود السريعة)، وعرض رسالة توضيحية بعد ~3 ثوانٍ ("لا زلنا نعمل، جارٍ مقارنة 400 فندق...")، وتعيين **مهلة زمنية (Timeout)** مع زر إعادة محاولة بعد 10-15 ثانية.
- **الإلغاء عبر `AbortController`**: لتمكين المستخدم من تغيير الفلتر أو مغادرة الصفحة دون أن تتسبب الردود البطيئة القديمة في استبدال النتائج الأحدث.

## Real-life example
في موقع لمقارنة عروض التأمين، تستدعي صفحة "جلب الأسعار" خدمة تجميع تستغرق بين 3 إلى 8 ثوانٍ. يشاهد المستخدمون شاشة بيضاء تماماً يتوسطها مؤشر دوران دون أي نص توضيحي. يفترض الكثيرون أن الصفحة تعطلت فيضغطون زر "رجوع" أو يعيدون تحديث الصفحة، مما يرسل طلباً ثانياً يستغرق 8 ثوانٍ أخرى. وإذا غير المستخدم نوع السيارة أثناء عمل الطلب الأول، يصل الرد القديم متأخراً ويستبدل النتائج الحديثة فيرى المستخدم عروض تأمين لسيارة مختلفة تماماً! وأظهرت التحليلات أن نسبة التخلي (Abandonment rate) في هذه الصفحة بلغت 35%.

```jsx
function QuotesPage({ carId }) {
  const [quotes, setQuotes] = useState(null);

  useEffect(() => {
    setQuotes(null);
    fetch(`/api/quotes?car=${carId}`)          // لا توجد مهلة زمنية ولا إلغاء للطلب
      .then(r => r.json())
      .then(setQuotes);                        // رد متأخر لسيارة سابقة قد يستبدل النتائج
  }, [carId]);

  if (!quotes) return <div className="spinner" />;  // استبدال كامل الصفحة بمؤشر دوران مزعج
  return <QuoteList quotes={quotes} />;
}
```

## How to fix it
```jsx
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

async function fetchQuotes(carId, signal) {
  const timeout = AbortSignal.timeout(15000);
  const res = await fetch(`/api/quotes?car=${carId}`, {
    signal: AbortSignal.any([signal, timeout]), // يُلغى عند إلغاء التركيب أو تغيير المفتاح أو بعد 15 ثانية
  });
  if (!res.ok) throw new Error(`فشل جلب العروض: ${res.status}`);
  return res.json();
}

function useElapsed(active) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!active) { setMs(0); return; }
    const start = Date.now();
    const id = setInterval(() => setMs(Date.now() - start), 500);
    return () => clearInterval(id);
  }, [active]);
  return ms;
}

function QuotesPage({ carId }) {
  const { data, isPending, isFetching, isPlaceholderData, error, refetch } = useQuery({
    queryKey: ['quotes', carId],
    queryFn: ({ signal }) => fetchQuotes(carId, signal), // تلغي React Query الطلبات القديمة تلقائياً
    staleTime: 5 * 60 * 1000,                            // العودة للصفحة تصبح فورية
    placeholderData: keepPreviousData,                   // إبقاء النتائج القديمة مرئية أثناء إعادة الجلب
  });
  const elapsed = useElapsed(isFetching);

  return (
    <main>
      <SearchSummary carId={carId} />           {/* إطار الصفحة متاح للاستخدام فوراً */}

      {isFetching && elapsed > 3000 && (
        <p role="status" aria-live="polite">
          جارٍ مقارنة أكثر من 40 شركة تأمين. تستغرق العملية عادة أقل من 10 ثوانٍ.
        </p>
      )}

      {error ? (
        <ErrorPanel
          message={error.name === 'TimeoutError' ? 'استغرقت العملية وقتاً أطول من المعتاد.' : 'تعذر تحميل العروض.'}
          onRetry={() => refetch()}
        />
      ) : isPending ? (
        <QuoteListSkeleton rows={5} />           // نفس هيكل القائمة الحقيقية لمنع قفزات التخطيط
      ) : (
        <div aria-busy={isFetching} style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
          <QuoteList quotes={data} />
        </div>
      )}
    </main>
  );
}
```
سبب نجاح الحل: يرى المستخدمون إطار الصفحة وهيكل الـ Skeleton فوراً، تليها رسالة توضيحية صادقة عن سير العمل، فيدركون أن التطبيق يعمل بكفاءة. وتضمن `keepPreviousData` مع `staleTime` ظهور العروض السابقة دون انقطاع عند تغيير الفلاتر، بينما تحبط إشارات الإلغاء سباق الطلبات (Race condition)، وتوفر المهلة المحددة (Timeout) خيار إعادة محاولة واضح بدلاً من مؤشر دوران أبدي.

## How to say it in the interview
- "أنا أصمم تجربة المستخدم المخصصة لفترة الانتظار: هيكل Skeleton فوري، واستعراض البيانات المخزنة مؤقتاً إن وجدت، وتغذية راجعة متصاعدة بالنصوص، ومهلة زمنية واضحة مع زر إعادة محاولة، وإلغاء فوري للطلبات السابقة حتى لا تسبق الردود الحديثة."
- "في عمليات التعديل (Writes) أستخدم الواجهات المتفائلة (Optimistic UI) مع إمكانية التراجع. وفي عمليات القراءة (Reads) أعتمد مبدأ stale-while-revalidate."
- فخ شائع: مؤشر الدوران الذي يغطي كامل الصفحة (Full-page spinner). فهو يخفي كل ما يمكن للمستخدم التفاعل معه، وظهوره لمدة تقل عن 300ms يسبب وميضاً بصرياً مزعجاً.
- الموازنة (Trade-off): قد تعرض الواجهات المتفائلة والبيانات القديمة معلومات غير دقيقة للحظات وجيزة. هذا مقبول تماماً لعداد الإعجابات، لكنه مرفوض تماماً في أرصدة الحسابات البنكية أو الأسعار النهائية للمعاملات.
