# الـ Debounce والـ Throttle والحفاظ على استجابة واجهة المستخدم مع الأحداث عالية التردد

**Level:** Mid
**Merged from (original phrasings):**
- اشرح مفهومي الـ Debouncing والـ Throttling مع أمثلة عملية.
- واجهة المستخدم لديك تستقبل آلاف الأحداث كل ثانية: كيف تحافظ على سلاستها واستجابتها؟

## The concept
- **الـ Debounce**: ينتظر حتى **تتوقف** الأحداث لمدة N مللي ثانية، ثم يُنفذ الدالة مرة واحدة. ممتاز للبحث أثناء الكتابة (search-as-you-type)، والحفظ التلقائي (autosave)، ونهاية تغيير حجم النافذة (resize-end)، والتحقق من صحة النماذج.
- **الـ Throttle**: يُنفذ الدالة **بمعدل لا يتجاوز مرة واحدة كل N مللي ثانية** طالما استمر تدفق الأحداث. ممتاز لتتبع موضع التمرير (scroll position)، واكتشاف وصول نهاية الصفحة (infinite-scroll)، وعمليات السحب والإفلات (drag)، وإرسال تحليلات التفاعل.
- **التجميع عبر rAF (rAF batching)**: دمج كافة التحديثات خلال الإطار الزمني الواحد وتطبيقها دفعة واحدة داخل `requestAnimationFrame`. يعمل هذا بمعدل تحديث الشاشة، وبالتالي لا تقوم بأي جهد إضافي في الـ DOM أكثر مما يمكن للشاشة رسمه.
- **التخزين المؤقت والتفريغ (Buffer and flush)**: بالنسبة لتدفقات البيانات (WebSocket ticks أو السجلات)، يتم دفع الرسائل القادمة إلى مصفوفة بسيطة (عملية رخيصة جداً)، ثم تفريغها في الـ State على فترات مؤقتة أو مع كل rAF. ينتج عن ذلك عملية تصيير (Render) واحدة لكل دفعة بدلاً من إعادة التصيير مع كل رسالة منفردة.
- **الـ Web Workers**: نقل عمليات تحليل الـ JSON والفرز والتجميع بعيداً عن الـ Main Thread، وإرسال النتائج النهائية الملخصة فقط إلى الواجهة.
- تقنيات إضافية: محاكاة العرض للقوائم الطويلة (Virtualization)، واستخدام `useDeferredValue` أو `startTransition` حتى تظل مدخلات المستخدم الملحة سريعة الاستجابة بينما يمكن مقاطعة عمليات التصيير الثقيلة.

```js
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function throttle(fn, wait) {
  let last = 0, t;
  return (...args) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else {
      clearTimeout(t); // استدعاء متأخر (trailing call) حتى لا تضيع القيمة الأخيرة
      t = setTimeout(() => { last = Date.now(); fn(...args); }, remaining);
    }
  };
}
```

## Real-life example
لوحة تحكم لتداول العملات الرقمية تستقبل حوالي 2,000 تحديث سعر في الثانية عبر الـ WebSocket. كل تحديث يستدعي `setPrices`، مما يعيد تصيير سجل الأوامر (Order Book) مع كل رسالة. اشتكى المستخدمون من أن زر "شراء" (Buy) يتأخر نصف ثانية في الاستجابة، والكتابة في حقل إدخال المبلغ بطيئة للغاية وتتأخر، ومراوح الجهاز تعمل بأقصى سرعة. وفي نفس التطبيق، يرسل مربع البحث طلباً برمجياً للـ API مع كل ضربة زر، وتومض النتائج وترتبك لأن الردود القديمة تصل متأخرة بعد الردود الحديثة.

```jsx
function OrderBook() {
  const [prices, setPrices] = useState({});

  useEffect(() => {
    const ws = new WebSocket('wss://example.com/ticks');
    ws.onmessage = (e) => {
      const tick = JSON.parse(e.data);
      setPrices((p) => ({ ...p, [tick.symbol]: tick.price })); // 2,000 عملية إعادة تصيير في الثانية!
    };
    return () => ws.close();
  }, []);

  return <PriceTable prices={prices} />;
}

function SymbolSearch() {
  const [results, setResults] = useState([]);
  return (
    <input
      onChange={async (e) => {
        const res = await fetch(`/api/symbols?q=${e.target.value}`); // طلب لكل ضربة زر
        setResults(await res.json());
      }}
    />
  );
}
```

## How to fix it
قم بتجميع تحديثات الأسعار مؤقتاً (Buffer) وتفريغها مرة واحدة في كل إطار رسم (Animation frame). وطبق Debounce على مدخلات البحث.

```jsx
function OrderBook() {
  const [prices, setPrices] = useState({});

  useEffect(() => {
    const ws = new WebSocket('wss://example.com/ticks');
    let buffer = {};   // أحدث سعر لكل عملة، خارج نطاق إدارة React
    let frame = 0;

    const flush = () => {
      frame = 0;
      const batch = buffer;
      buffer = {};
      setPrices((p) => ({ ...p, ...batch })); // حد أقصى ~60 عملية تصيير في الثانية
    };

    ws.onmessage = (e) => {
      const tick = JSON.parse(e.data);
      buffer[tick.symbol] = tick.price;          // التحديث الأحدث يستبدل الأقدم
      if (!frame) frame = requestAnimationFrame(flush);
    };

    return () => {
      ws.close();
      cancelAnimationFrame(frame);
    };
  }, []);

  return <PriceTable prices={prices} />;
}

function SymbolSearch() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debounced) return;
    const ctrl = new AbortController();
    fetch(`/api/symbols?q=${encodeURIComponent(debounced)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then(setResults)
      .catch((err) => { if (err.name !== 'AbortError') console.error(err); });
    return () => ctrl.abort(); // الردود القديمة والملغاة لن تستبدل النتائج الحديثة إطلاقاً
  }, [debounced]);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```
سبب نجاح الحل: معالج الـ WebSocket يقوم الآن بعملية بسيطة O(1) لكل رسالة واردة. يقوم React بإعادة التصيير بمعدل أقصاه مرة واحدة لكل إطار شاشة بأحدث الأسعار المجمعة، مما يبقي الـ Main Thread حراً للاستجابة للنقرات والكتابة. أما البحث فيرسل طلباً واحداً فقط بعد أن يتوقف المستخدم عن الكتابة لمدة 300 مللي ثانية، وتضمن `AbortController` إلغاء أي طلبات أصبحت قديمة.

إذا كانت معالجة JSON أو تجميع البيانات ثقيلة بحد ذاتها (آلاف الرسائل بأحجام ضخمة)، افتح اتصال الـ WebSocket داخل **Web Worker**، وقم بعمليات التجميع هناك، ثم أرسل لقطة مدمجة وموجزة عبر `postMessage` كل 100 مللي ثانية. كما يمكنك تطبيق الـ Virtualization على جدول الأسعار إذا كان يحتوي على آلاف الصفوف.

## How to say it in the interview
- "الـ Debounce ينتظر فترة من الهدوء وانقطاع الأحداث، بينما الـ Throttle يحدد سقفاً أعلى لمعدل التنفيذ. وللتحديثات البصرية، أدمج التغييرات مع `requestAnimationFrame` لأن الشاشة لا تستطيع عرض أكثر من إطار واحد لكل دورة إنعاش (Refresh)."
- "للتعامل مع طوفان من الأحداث (Firehose)، أفصل استقبال البيانات عن التصيير: أجمعها في متغير محلي بسيط (Buffer)، ثم أفرغها في الـ State بجدولة محددة، وأنقل أي معالجة ثقيلة إلى Web Worker."
- فخ شائع: إنشاء دالة الـ debounce داخل جسم المكون دون استخدام `useMemo` أو `useRef`. سيؤدي ذلك إلى إعادة إنشاء دالة debounce جديدة مع كل تصيير، وبالتالي لن تطبق الـ debounce أبداً.
- الموازنة (Trade-off): يضيف الـ Debounce زمن انتظار طفيفاً (ينتظر المستخدم 300ms بعد التوقف). وقد يتجاهل الـ Throttle بعض القيم الوسيطة، لذا تأكد من تفعيل الاستدعاء المتأخر (trailing call) لضمان دقة الحالة النهائية.
