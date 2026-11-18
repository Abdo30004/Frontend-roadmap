# كيف تعمل دالة التنظيف (Cleanup) في useEffect، ولماذا يُعد إلغاء التركيب (Unmounting) مهماً؟

**Level:** Mid
**Merged from (original phrasings):**
- كيف تعمل دالة التنظيف (Cleanup function) في "useEffect"؟
- ما الهدف من مرحلة إلغاء التركيب (Unmounting phase) في React؟

## The concept
- الدالة التي **تُرجعها (return)** من الـ Effect هي دالة التنظيف (Cleanup function). يستدعيها React في حالتين:
  1. **قبل إعادة تشغيل الـ Effect مجدداً** عند تغير إحدى الاعتماديات (يتم التنظيف باستخدام القيم *القديمة*، ثم يُنفذ الـ Effect بالقيم الجديدة).‏
  2. **عند إلغاء تركيب المكون (Unmount)** (إزالته من الشجرة، أو تغيير المسار، أو تحول شرط العرض الشرطي إلى خطأ، أو تغير الـ `key`).‏
- مرحلة إلغاء التركيب هي اللحظة الحاسمة **لتحرير وإلغاء كل ما بدأه المكون خارج نطاق React**: المؤقتات (Timers)، والتكرار الدوري (Intervals)، ومستمعي الأحداث (Event listeners)، واتصالات WebSocket/SSE، والاشتراكات، وطلبات الشبكة الجارية (`AbortController`)، وعناصر مكتبات الطرف الثالث (الخرائط، والرسوم البيانية)، وكائنات المراقبة (Observers).‏
- يؤدي إهمال التنظيف إلى **تسريبات الذاكرة (Memory Leaks)**، وتكرار مستمعي الأحداث، واستمرار عمل المؤقتات في الخلفية، وتحديث الحالة بواسطة ردود شبكة لمكون قد اختفى بالفعل أو أصبح يعرض بيانات مختلفة.
- تذكر هذه القاعدة: **يجب أن تكون دالة التنظيف (Cleanup) مرآة عاكسة ومطابقة لعملية الإعداد (Setup)**. فإذا استدعيت `addEventListener`، يجب أن تستدعي `removeEventListener` بنفس مرجع الدالة تماماً.
- **الوضع الصارم (StrictMode في بيئة التطوير فقط)**: يقوم React 18+ بتركيب المكون، ثم **يشغل دالة التنظيف فوراً ويعيد تشغيل الـ Effect مجدداً** (mount -> unmount -> mount). هذا السلوك متعمد لكشف دوال التنظيف المفقودة أو المعيبة. فإذا تعطل تطبيقك أو اشترك مرتين في بيئة التطوير، فهذا يعني أن دالة التنظيف لديك غير مكتملة (وهذا لا يحدث في بيئة الإنتاج Production).‏

## Real-life example
في تطبيق لطلب سيارات الأجرة، تقوم شاشة "السائق في الطريق" بالاستعلام الدوري عن موقع السائق كل 3 ثوانٍ وتستمع لحدث `visibilitychange` لإيقاف الاستعلام عند إخفاء التبويب. بعد قيام المستخدمين بفتح الشاشة وإغلاقها عدة مرات (أو التبديل بين رحلات مختلفة)، تظهر لوحة الشبكة (Network tab) وجود 5 إلى 6 حلقات استعلام تعمل بالتوازي، مما يستنزف بطارية الهاتف، وأحياناً تعرض الخريطة موقع سائق **الرحلة السابقة** لأن مؤقتاً قديماً لا يزال يكتب في الـ State!‏

```jsx
function DriverTracker({ rideId }) {
  const [position, setPosition] = useState(null);

  useEffect(() => {
    const id = setInterval(async () => {
      const res = await fetch(`/api/rides/${rideId}/driver-location`);
      setPosition(await res.json()); // قد ينتمي هذا الرد لـ rideId قديم
    }, 3000);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearInterval(id);
    });
    // خطأ: لا توجد دالة cleanup! المؤقت والمستمع يعيشان إلى الأبد.
  }, [rideId]);

  return <DriverMap position={position} />;
}
```
في بيئة التطوير مع تفعيل StrictMode، يظهر الخطأ فوراً: يعمل مؤقتان منذ أول تركيب، لأن الـ Effect نفذ مرتين دون تنظيف.

## How to fix it
```jsx
function DriverTracker({ rideId }) {
  const [position, setPosition] = useState(null);

  useEffect(() => {
    let intervalId = null;
    let controller = null;

    const poll = async () => {
      controller?.abort();                 // إلغاء الطلب السابق
      controller = new AbortController();
      try {
        const res = await fetch(`/api/rides/${rideId}/driver-location`, {
          signal: controller.signal,
        });
        setPosition(await res.json());
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
      }
    };

    const start = () => {
      if (intervalId === null) {
        poll();
        intervalId = setInterval(poll, 3000);
      }
    };
    const stop = () => {
      clearInterval(intervalId);
      intervalId = null;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener('visibilitychange', onVisibility);

    // دالة التنظيف Cleanup: تنفذ قبل تغير rideId وعند إلغاء التركيب
    return () => {
      stop();
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibility); // نفس مرجع الدالة
    };
  }, [rideId]);

  return <DriverMap position={position} />;
}
```
سبب نجاح الحل: يتم تحرير وإلغاء كل مورد ينشئه الـ Effect داخل دالة التنظيف. وعند تغير `rideId`، يتم إيقاف المؤقت القديم وإلغاء الطلب القديم وإزالة المستمع القديم **قبل** بدء تشغيل العناصر الجديدة، وبالتالي يستحيل أن تستبدل البيانات القديمة البيانات الحديثة. وعند إلغاء التركيب، يتوقف كل شيء تماماً. وبذلك يصبح سلوك الـ StrictMode المزدوج آمناً تماماً (تشغيل -> تنظيف -> تشغيل).‏

حلول بديلة: للاستعلام الدوري عن بيانات الخادم، تتكفل مكتبات مثل TanStack Query (`refetchInterval` مع `refetchIntervalInBackground: false`) بإدارة دورة الحياة هذه تلقائياً. ولحالات المتاجر الخارجية، يدير `useSyncExternalStore` عمليات الاشتراك وإلغاء الاشتراك باحترافية.

### ترتيب دورة التنفيذ للحفظ
```
عند التركيب (Mount):             render -> commit -> effect(rideId=1)
عند تغير rideId:                 render -> commit -> cleanup(rideId=1) -> effect(rideId=2)
عند إلغاء التركيب (Unmount):     cleanup(rideId=2)
في الوضع الصارم StrictMode:     effect -> cleanup -> effect   (عند أول تركيب فقط)
```

## How to say it in the interview
- "دالة التنظيف (Cleanup) هي المرآة العاكسة لعملية الإعداد (Setup). يشغلها React قبل إعادة تنفيذ الـ Effect وعند إلغاء تركيب المكون، لضمان عدم بقاء أي مؤقتات أو مستمعي أحداث أو طلبات معلقة خلفه."
- "الوضع الصارم (StrictMode) يقوم بالتركيب ثم إلغاء التركيب ثم التركيب مجدداً في بيئة التطوير. فإذا تعطل شيء ما بسبب ذلك، فهذا دليل على غياب دالة التنظيف. والعلاج الصحيح هو كتابة cleanup سليم وليس وضع علم في `useRef` لتخطي التشغيل الثاني."
- فخ شائع: استدعاء `removeEventListener` بتمرير دالة سهمية مجهولة جديدة (inline arrow function)؛ هذا لا يفعل شيئاً لأنها تمثل مرجعاً مختلفاً في الذاكرة.
- سؤال متابعة/موازنة: لا تحتاج جميع الـ Effects إلى cleanup (مثل تحديث `document.title`)، ولكن أي شيء يتضمن اشتراكاً أو جدولة زمنية أو طلباً شبكياً يتطلب cleanup حتماً.
