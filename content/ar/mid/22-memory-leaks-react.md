# ما الذي يسبب تسريبات الذاكرة (Memory Leaks) في React، وكيف تكتشفها وتصلحها؟

**Level:** Mid
**Merged from (original phrasings):**
- ما الذي يسبب تسريبات الذاكرة في React، وكيف تقوم بتصحيحها وتتبعها؟

## The concept
- **تسريب الذاكرة (Memory Leak)** هو بقاء كائنات في الذاكرة قابلة للوصول (**Still reachable** مما يمنع جامع المهملات Garbage Collector من تحريرها) على الرغم من عدم حاجة التطبيق إليها بعد الآن. وفي تطبيقات الصفحة الواحدة (SPAs)، تتراكم التسريبات تدريجياً لعدم إعادة تحميل الصفحة، فتتضخم الذاكرة مع كل تنقل حتى تصبح التبويبات بطيئة للغاية أو تنهار تماماً.
- **الأسباب الأكثر شيوعاً في React:**
  - خطافات الـ Effects التي تبدأ اشتراكات دون دالة تنظيف (Cleanup): مثل `window.addEventListener`، و `setInterval`، واتصالات WebSocket/SSE، وكائنات المراقبة `ResizeObserver` / `IntersectionObserver`، ومكتبات الطرف الثالث (الخرائط، والرسوم البيانية) التي لا يُستدعى لها تابع `.destroy()`.
  - **الدوال المغلقة (Closures)** التي تُبقيها تلك المستمعات حية: تستشهد دوال رد النداء بحالة المكون أو خصائصه أو بيانات ضخمة، فتظل تلك المتغيرات بأكملها عالقة في الذاكرة.
  - **عقد الـ DOM المنفصلة (Detached DOM Nodes)**: احتفاظ متغيرات على مستوى الملف (Module-level)، أو ذاكرة التخزين المؤقت، أو مكتبات خارجية بمراجع لعناصر DOM أزالها React بالفعل من الصفحة.
  - **المخازن المؤقتة غير المحدودة (Unbounded caches)**: مثل مصفوفات السجلات العامة `logs.push(...)` التي تنمو دون سقف أقصى.
- **استراتيجية الإصلاح**: يجب على كل Effect يبدأ مورداً خارجياً أن يُرجع دالة تنظيف توقفه وتحرره تماماً. واستخدام `AbortController` للطلبات، ومخازن محددة الحجم (Bounded LRU Caches) أو `WeakMap` لكائنات الذاكرة المؤقتة.
- **طريقة التتبع والتصحيح (Debugging)**: عبر تبويب **Memory** في أدوات مطوري Chrome. التقط لقطة للذاكرة (Heap Snapshot)، ثم كرر الإجراء المشبوه عدة مرات (فتح وإغلاق نافذة منبثقة، أو التنقل بين الصفحات)، ثم اضغط على أيقونة سلة المهملات لفرض جمع القمامة (Force GC)، والتقط لقطة ثانية. استخدم طريقة عرض **Comparison** وفلتر النتائج بكلمة "Detached" لكشف عناصر الـ DOM العالقة، وتتبع لوحة **Retainers** لمعرفة المتغير الذي يمسك الكائن ويمنع حذفه.

## Real-life example
لوحة تداول أسهم يتركها المتداولون مفتوحة طوال اليوم. بعد ساعات من التبديل بين العملات والأدوات المالية، يستهلك التبويب 2.5GB من الذاكرة العشوائية (RAM)، وتتقطع الرسوم البيانية، ويظهر متصفح Chrome في النهاية شاشة الانهيار الشهيرة "Aw, Snap!". أظهرت لوحة مراقبة الأداء (Performance Monitor) تزايداً مستمراً في عدد "JS event listeners" و "DOM Nodes" مع كل تبديل للأداة المالية. وكشفت مقارنة لقطات الذاكرة عن آلاف كائنات `Detached HTMLDivElement` و `Detached HTMLCanvasElement` محبوسة بفعل دالة رد نداء مستمع حدث `resize` وسجل المكتبة الداخلي للرسم البياني.

```jsx
const priceHistoryCache = {}; // متغير عام ينمو للأبد بلا سقف!

function PriceChart({ symbol }) {
  const containerRef = useRef(null);
  const [ticks, setTicks] = useState([]);

  useEffect(() => {
    const chart = createChart(containerRef.current);           // لا يتم تدميره مطلقاً
    const ws = new WebSocket(`wss://feed.example.com/${symbol}`); // لا يتم إغلاقه
    ws.onmessage = e => {
      const tick = JSON.parse(e.data);
      priceHistoryCache[symbol] = [...(priceHistoryCache[symbol] ?? []), tick]; // كاش لا نهائي
      setTicks(t => [...t, tick]);
      chart.update(tick);
    };
    window.addEventListener('resize', () => chart.resize());   // دالة مجهولة لا يمكن إزالتها
    setInterval(() => chart.redraw(), 1000);                   // مؤقت لا يتوقف
  }, [symbol]);

  return <div ref={containerRef} />;
}
```

## How to fix it
```jsx
const MAX_TICKS = 5000;
const priceHistoryCache = new Map(); // مخزن مؤقت محدود الحجم

function PriceChart({ symbol }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const chart = createChart(containerRef.current);
    const ws = new WebSocket(`wss://feed.example.com/${symbol}`);

    ws.onmessage = e => {
      const tick = JSON.parse(e.data);
      const history = priceHistoryCache.get(symbol) ?? [];
      history.push(tick);
      if (history.length > MAX_TICKS) history.splice(0, history.length - MAX_TICKS);
      priceHistoryCache.set(symbol, history);
      chart.update(tick);             // مكتبة الرسم هي من تدير العرض دون الحاجة لـ React state لكل تحديث
    };

    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    const redrawId = setInterval(() => chart.redraw(), 1000);

    return () => {                    // دالة التنظيف تنفذ عند إلغاء التركيب وقبل إعادة تشغيل الـ Effect
      ws.close();
      window.removeEventListener('resize', onResize);
      clearInterval(redrawId);
      chart.destroy();                // تحرير عنصر canvas ومراجع المكتبة الداخلية
    };
  }, [symbol]);

  return <div ref={containerRef} />;
}
```
سبب نجاح الحل: تقوم دالة التنظيف بإلغاء كل ما تم إنشاؤه تماماً؛ فيُغلق الـ Socket وتُزال مستمعات الأحداث ويُلغى المؤقت وتُدمر أداة الرسم البياني عبر `chart.destroy()`. وبمجرد انقطاع المراجع تصبح الكائنات غير قابلة للوصول فيحررها جامع المهملات تلقائياً. كما تم تقييد حجم الذاكرة المؤقتة بسقف أقصى ثابت.

خطوات التحقق من نجاح الإصلاح:
1. افتح تبويب Memory في DevTools والتقط Heap snapshot مرجعية.
2. بدل بين الأدوات المالية 20 مرة، ثم عد للأداة الأولى، واضغط أيقونة سلة المهملات لفرض جمع القمامة (Force GC)، والتقط اللقطة الثانية.
3. في نافذة Comparison: يجب أن تعود أعداد `Detached HTMLCanvasElement` و `WebSocket` إلى الصفر ومستواها الأساسي بدلاً من زيادتها بـ 20.

## How to say it in the interview
- "تنشأ معظم تسريبات الذاكرة في React من خطافات Effects تبدأ اشتراكات أو مؤقتات أو عناصر طرف ثالث دون توفير دالة تنظيف (Cleanup)، أو من مراجع طويلة الأجل تحتجز عقد DOM محذوفة (Detached DOM nodes)."
- "أتتبع التسريبات بمقارنة لقطات الذاكرة (Heap Snapshot Comparison): أكرر الإجراء، وأفرض جمع القمامة، وأقارن اللقطات بفلتر 'Detached'، وأتتبع سلسلة الممسكات (Retainers) حتى أصل للمتغير المسؤول."
- فخ شائع: الاعتقاد بأن "تحذير setState on unmounted component يعني بالضرورة تسريباً للذاكرة". أزال React 18 هذا التحذير لأنه كان مضللاً في كثير من الأحيان، فالتسريب الحقيقي هو استمرار عمل الاشتراك في الخلفية.
- الموازنة (Trade-off): الذاكرة المؤقتة (Caching) تسرع التطبيق ولكنها يجب أن تكون محدودة بسقف أقصى (LRU / TTL أو `WeakMap`)، وإلا تحولت هي نفسها إلى تسريب ذاكرة خطير.
