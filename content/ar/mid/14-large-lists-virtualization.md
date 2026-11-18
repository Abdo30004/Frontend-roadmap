# كيف تصيّر وتصحح القوائم الضخمة (10,000 إلى 50,000+ عنصر) دون أي تباطؤ؟

**Level:** Mid
**Merged from (original phrasings):**
- كيف تصيّر جدولاً يحتوي على أكثر من 50,000 سجل بكفاءة عالية؟
- صفحة تعرض 10,000 عنصر وتبدأ بالتباطؤ والتقطيع (Lagging): ماذا تفعل؟
- قائمة تحتوي على 5,000 صف تعاني من التقطع (Jank): كيف تحدد السبب الجذري قبل كتابة أي كود؟

## The concept
- **القياس أولاً**: ابدأ بتسجيل الأداء في تبويب Performance بأدوات مطوري Chrome (ابحث عن المهام الطويلة Long Tasks، وكتل Recalculate Style و Layout، وزمن معالجة البرمجة Scripting)، واستخدم React DevTools Profiler (لمعرفة المكونات التي يعاد تصييرها وتكرارها وأسبابها عبر تفعيل "Record why each component rendered"). فالسبب قد يكون حجم الـ DOM الضخم، أو عواصف إعادة التصيير، أو عمليات مكلفة داخل الصفوف، أو تزاحم التخطيط (Layout thrashing).
- **السبب الرئيسي دائماً هو تضخم الـ DOM**: وجود 50,000 صف × 8 خلايا يعني وجود 400,000 عقدة في شجرة الـ DOM! وحسابات الأنماط والتخطيط والرسم تتناسب طردياً مع عدد العقد، بالإضافة إلى عبء مطابقة React (Reconciliation) لكل صف عند أي إعادة تصيير للأب.
- **محاكاة العرض الافتراضية (Virtualization / Windowing)**: تصيير العناصر الموجودة في نافذة العرض المرئية (Viewport) فقط بالإضافة لهامش فحص صغير (حوالي 30 صفاً)، مع استخدام عنصر مباعدة (Spacer) بالارتفاع الإجمالي للمحافظة على موضع شريط التمرير بدقة. أشهر المكتبات: TanStack Virtual (`@tanstack/react-virtual`) و react-window.
- **لا ترسل البيانات بأكملها للمتصفح دفعة واحدة**: استخدم التقسيم لصفحات من الخادم (Server-side pagination) أو التحميل اللانهائي، مع تطبيق الفرز والبحث على الخادم. فـ 50 ألف كائن JSON تشكل عبئاً ثقيلاً على الشبكة والذاكرة.
- **تقليل تكلفة إعادة التصيير**: استخدام `React.memo` للصفوف مع خصائص مستقرة (دوال `useCallback` وتمرير معرّفات بسيطة)، وإخراج حالة التحديد خارج الأب، واستخدام `useDeferredValue` أو الـ debouncing لحقول الفرز والبحث.
- **مساعدة من CSS**: خاصية `content-visibility: auto` تتيح للمتصفح تخطي تصيير المحتوى الواقع خارج الشاشة عندما يتعذر تطبيق الـ virtualization.

## Real-life example
في لوحة تحكم للخدمات اللوجستية، تعرض صفحة "الشحنات" 20,000 شحنة داخل جدول مع حقل بحث نصي. اشتكى المستخدمون من أن كتابة أي حرف في البحث تجمد الصفحة لمدة ثانيتين، والتمرير متقطع للغاية. أظهر تبويب Performance مهاماً طويلة مدتها 1.8 ثانية لكل ضربة مفتاح، وأوضح الـ Profiler أن كل صف `ShipmentRow` يُعاد تصييره بالكامل مع كل حرف لأن دالة `onSelect` تتجدد في كل دورة وتتم تصفية المصفوفة في المسار الحرج للكتابة.

```jsx
function ShipmentsPage({ shipments }) { // 20,000 عنصر
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const filtered = shipments.filter(s =>
    s.customer.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <table>
        <tbody>
          {filtered.map(s => (
            <ShipmentRow
              key={s.id}
              shipment={s}
              selected={s.id === selectedId}
              onSelect={() => setSelectedId(s.id)} // دالة جديدة لكل صف مع كل تصيير
            />
          ))}
        </tbody>
      </table>
    </>
  );
}
```

## How to fix it
```jsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';

const ROW_HEIGHT = 40;

const ShipmentRow = memo(function ShipmentRow({ shipment, selected, onSelect, style }) {
  return (
    <div role="row" style={style} className={selected ? 'row selected' : 'row'}
         onClick={() => onSelect(shipment.id)}>
      <span role="cell">{shipment.trackingNo}</span>
      <span role="cell">{shipment.customer}</span>
      <span role="cell">{shipment.status}</span>
    </div>
  );
});

function ShipmentsPage({ shipments }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query); // استجابة فورية للكتابة
  const [selectedId, setSelectedId] = useState(null);
  const onSelect = useCallback(id => setSelectedId(id), []); // مرجع مستقر

  const filtered = useMemo(() => {
    const q = deferredQuery.toLowerCase();
    return shipments.filter(s => s.customerLower.includes(q)); // تحويل مسبق لحروف صغيرة
  }, [shipments, deferredQuery]);

  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث عن عميل" />
      <div ref={parentRef} role="table" style={{ height: 600, overflow: 'auto' }}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map(v => {
            const s = filtered[v.index];
            return (
              <ShipmentRow
                key={s.id}
                shipment={s}
                selected={s.id === selectedId}
                onSelect={onSelect}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%',
                         height: v.size, transform: `translateY(${v.start}px)` }}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
```
سبب نجاح الحل:
- يوجد حوالي 25 صفاً فقط في الـ DOM في أي لحظة بدلاً من 20,000، مما يجعل تكاليف الـ Layout والـ Paint ثابتة ومنخفضة مهما تضخمت البيانات.
- تغليف الصف بـ `memo` مع تثبيت مرجع `onSelect` يجعل تغيير العنصر المحدد يعيد تصيير الصفين المعنيين فقط بدلاً من الجدول بأكمله.
- يتيح `useDeferredValue` تحديث حقل الإدخال فوراً دون أي شعور بالتأخير بينما تجري تصفية القائمة وتصييرها بأولوية منخفضة في الخلفية.
- ولما زاد عن 50 ألف سجل: انقل الفرز والتصفية إلى خادم الـ API عبر التصفح المقسم (Pagination) حتى لا يحمل المتصفح كامل البيانات في الذاكرة.

بدائل أخرى: مكتبة react-window للحالات البسيطة، أو AG Grid مع TanStack Table للجداول المتقدمة، أو التقسيم التقليدي لصفحات (Pagination) إذا لم يكن التمرير المستمر مطلوباً.

## How to say it in the interview
- "قبل أن أعدل أي سطر برمجي أقوم بقياس الأداء: تبويب Performance يكشف إن كان الوقت يضيع في البرمجة أم في عمليات الـ Layout والرسم، ويوضح React Profiler أي المكونات يعاد تصييرها وسبب ذلك. ثم أختار الحل المطابق للسبب الجذري."
- "لعشرات الآلاف من الصفوف، تحافظ تقنية الـ Virtualization على حجم DOM ثابت وصغير. وللبيانات الضخمة جداً، أنقل التصفية والفرز والتقسيم إلى الخادم بالكامل."
- فخاخ شائعة: تعطل الـ Virtualization خاصية البحث الافتراضية في المتصفح (Ctrl+F)، وتتطلب عناية إضافية بإمكانية الوصول (Accessibility عبر `aria-rowcount` و `aria-rowindex`)، وتحتاج تعاملاً خاصاً مع الصفوف ذات الارتفاعات المتغيرة (`measureElement` في TanStack Virtual).
- الموازنة (Trade-off): استخدام `React.memo` ليس مجانياً في كل مكان. استخدمه مع صفوف القوائم لأنها تقع في المسار الحرج السريع، واحرص على تثبيت الخصائص الممررة وإلا فلن يكون له أي أثر.
