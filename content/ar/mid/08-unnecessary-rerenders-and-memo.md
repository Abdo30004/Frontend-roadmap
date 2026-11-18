# كيف تكتشف عمليات إعادة التصيير غير الضرورية وتمنعها، ومتى يفشل استخدام memo؟

**Level:** Mid
**Merged from (original phrasings):**
- كيف تكتشف وتمنع عمليات إعادة التصيير (Re-renders) غير الضرورية في تطبيق React كبير؟
- عندما يُعاد تصيير المكون الأب، أي الأبناء يُعاد تصييرهم، ومتى يفشل استخدام memo؟

## The concept
- يُعاد تصيير المكون في React عند **تغير حالته (State)، أو إعادة تصيير المكون الأب (Parent)، أو تغير قيمة Context يشترك فيه**. وافتراضياً، عند إعادة تصيير الأب، **يُعاد تصيير كافة الأبناء الواردين في كود الـ JSX التابع له تلقائياً**، حتى لو لم تتغير أي من خصائصهم (Props)!‏
- يقوم `React.memo(Child)` بتخطي إعادة التصيير إذا كانت كافة الخصائص متطابقة سطحياً (**Shallowly equal** عبر `Object.is`) مع قيمها في دورة التصيير السابقة.
- يفشل `memo` في تفادي إعادة التصيير عندما تنشأ مراجع جديدة للخصائص في كل دورة:
  - الكائنات والمصفوفات المعرفة مباشرة في الـ JSX: مثل `style={{...}}`، و `options={[...]}`, و `filter={{ status }}`.‏
  - الدوال المعرفة مباشرة (Inline functions): مثل `onClick={() => ...}`.‏
  - تمرير عناصر الـ JSX كـ `children` (يُنشئ React كائن عنصر جديد مع كل تصيير).‏
  - قراءة المكون الابن لـ Context تغيرت قيمته (لا يستطيع `memo` منع تحديثات الـ Context).‏
- الحلول: استخدام `useMemo` و `useCallback` لتثبيت الخصائص الممررة للأبناء المغلفين بـ memo، **ونزول الحالة لأسفل الشجرة (State colocation)**، و**تمرير المكونات كـ `children`** بحيث يتم إنشاؤها بواسطة مكون أب لا يعاد تصييره، وتقسيم الـ Contexts الكبيرة.
- **القاعدة الذهبية: القياس أولاً، والتحسين ثانياً**: استخدم React DevTools Profiler (سجل الأداء، وافحص مخطط الشعلة Flame Graph، وفعل خيار "Record why each component rendered")، وخيار "Highlight updates when components render"، وأداة `why-did-you-render` في بيئة التطوير، ومكون `<Profiler>` البرمجي لقياس أزمنة المكونات.
- **مترجم React (React Compiler)**: يقوم بالتحفيظ التلقائي (Automatic memoization) وقت البناء (Build time)، مما يغنيك عن كتابة معظم `useMemo` و `useCallback` و `memo` يدوياً، مع بقاء الحاجة لبنية حالة نظيفة.

## Real-life example
في لوحة تحكم CRM لإدارة العملاء، تؤدي الكتابة داخل حقل "الملاحظة السريعة" في أعلى صفحة العملاء إلى بطء شديد: تستغرق كل ضربة زر حوالي 150 مللي ثانية. عند فتح الـ Profiler، تبين أن كل ضربة زر تعيد تصيير جدول العملاء `CustomerTable` الذي يحتوي على 500 صف بالكامل، على الرغم من أن الجدول مغلف بـ `memo`!‏

```jsx
const CustomerTable = memo(function CustomerTable({ customers, filter, onSelect }) {
  const visible = customers.filter((c) => c.status === filter.status);
  return visible.map((c) => <CustomerRow key={c.id} customer={c} onSelect={onSelect} />);
});

function CustomersPage({ customers }) {
  const [note, setNote] = useState('');          // تتغير مع كل ضربة زر
  const [status, setStatus] = useState('active');
  const [selectedId, setSelectedId] = useState(null);

  return (
    <>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      <StatusTabs value={status} onChange={setStatus} />
      <CustomerTable
        customers={customers}
        filter={{ status }}                       // كائن جديد في كل تصيير -> يفشل memo!
        onSelect={(id) => setSelectedId(id)}      // دالة جديدة في كل تصيير -> يفشل memo!
      />
      <CustomerDrawer id={selectedId} />
    </>
  );
}
```
سجل الـ Profiler لسبب إعادة التصيير: `Props changed: filter, onSelect`. القيم متطابقة منطقياً، لكن مراجع الذاكرة جديدة تماماً في كل مرة.

## How to fix it
يتم الإصلاح عبر خطوتين أساسيتين: نقل الحالة سريعة التغير لأسفل، وتثبيت مراجع الخصائص.

```jsx
// 1. عزل الحالة (State Colocation): تعيش حالة الملاحظة داخل مكونها المنفصل
function QuickNote() {
  const [note, setNote] = useState('');
  return <textarea value={note} onChange={(e) => setNote(e.target.value)} />;
}

function CustomersPage({ customers }) {
  const [status, setStatus] = useState('active');
  const [selectedId, setSelectedId] = useState(null);

  // 2. تثبيت مراجع الذاكرة للخصائص الممررة للابن المحفوظ (Memoized)
  const filter = useMemo(() => ({ status }), [status]);
  const handleSelect = useCallback((id) => setSelectedId(id), []);

  return (
    <>
      <QuickNote />                       {/* الكتابة تعيد تصيير QuickNote فقط */}
      <StatusTabs value={status} onChange={setStatus} />
      <CustomerTable customers={customers} filter={filter} onSelect={handleSelect} />
      <CustomerDrawer id={selectedId} />
    </>
  );
}
```
سبب نجاح الحل: تؤدي الكتابة الآن إلى تحديث الحالة محلياً داخل `QuickNote`، فلا يُعاد تصيير `CustomersPage` مطلقاً. وعندما يُعاد تصيير الصفحة لسبب آخر (مثل تغيير `selectedId`)، يحتفظ `filter` و `handleSelect` بنفس مراجع الذاكرة، فيتخطى `memo` إعادة تصيير الجدول. والأبسط من ذلك: تمرير `status` كنص بسيط (String) بدلاً من كائن `filter`؛ فالأنواع الأولية تُقارن بقيمتها لا بمراجعها.

### نمط تمرير المكونات كـ Children (The children-as-props pattern)
```jsx
function ScrollTracker({ children }) {
  const [y, setY] = useState(0);
  useEffect(() => {
    const onScroll = () => setY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <div><ProgressBar value={y} />{children}</div>;
}

// تم إنشاء <HeavyArticle /> بواسطة App، وليس بواسطة ScrollTracker،
// لذلك يؤدي التمرير إلى إعادة تصيير ScrollTracker دون المساس بـ HeavyArticle إطلاقاً!
<ScrollTracker><HeavyArticle /></ScrollTracker>
```

### إعداد كشف الأداء في بيئة التطوير
```js
// src/wdyr.js، يتم استيراده في أول مدخل التطوير فقط
import React from 'react';
if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, { trackAllPureComponents: true });
}
```

## How to say it in the interview
- "عندما يُعاد تصيير المكون الأب، يُعاد تصيير كافة أبنائه تلقائياً. ولا يفيد استخدام `memo` إلا إذا كانت جميع الخصائص مستقرة مرجعياً، فالكائنات والدوال المباشرة وعناصر `children` تكسر الـ memo خلسة."
- "أقيس دائماً أولاً باستخدام الـ Profiler؛ فمعظم عمليات إعادة التصيير سريعة وغير مكلفة، ولا أركز جهدي إلا على الأجزاء البطيئة أو كثيرة التكرار."
- "أولى أدواتي هي التعديلات الهيكلية: نقل الحالة للأسفل (State colocation)، ورفع المحتوى كـ `children`، وتقسيم الـ Contexts. ويأتي استخدام `useMemo` و `useCallback` بعد ذلك، كما يتكفل React Compiler بمعظمها تلقائياً."
- الموازنة (Trade-off): التحفيظ (Memoization) يستهلك ذاكرة إضافية ومقارنات في كل تصيير ويزيد تعقيد الكود. تغليف كل شيء بـ `memo` دون قياس حقيقي قد يجعل التطبيق أبطأ وأصعب في الصيانة.
