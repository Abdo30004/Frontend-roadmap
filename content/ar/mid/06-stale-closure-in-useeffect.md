# دالة رد النداء في useEffect([]) تقرأ قيمة قديمة (Stale Value): لماذا يحدث ذلك وكيف تصلحه؟

**Level:** Mid
**Merged from (original phrasings):**
- دالة رد النداء في useEffect([]) تقرأ قيمة قديمة (stale value). لماذا يحدث ذلك، وكيف تعالجه؟

## The concept
- كل دورة تصيير (Render) للمكون الدالي (Function Component) هي عبارة عن **استدعاء دالة جديد تماماً** بخصائصها (Props) وحالتها (State) ودوالها الخاصة. الدوال المغلقة (Closures) التي تنشأ أثناء تلك الدورة **تلتقط قيم تلك الدورة تحديداً وتحتفظ بها**.
- الكود `useEffect(fn, [])` يُنفذ **مرة واحدة فقط بعد أول عملية تصيير**. وأي دالة رد نداء يسجلها (مثل مؤقت interval، أو مستمع أحداث، أو معالج WebSocket) تحتفظ بالـ Closure المأخوذ من دورة التصيير الأولى إلى الأبد، وبالتالي فإنها ترى دوماً الحالة والخصائص **الابتدائية فقط**. هذا ما يُعرف بالـ Stale Closure (الإغلاق القديم أو المنتهي الصلاحية).‏
- هذا ليس خطأ برمجياً في React، بل هو التطبيق الطبيعي لقواعد الـ Closures في JavaScript مقترناً بمصفوفة اعتماديات فارغة تكذب بشأن ما يستخدمه الـ Effect فعلياً.
- الحلول مرتبة من الأفضل إلى الأكثر تخصصاً:
  1. **التصريح بالاعتماديات الحقيقية** (يعيد الـ Effect الاشتراك عندما تتغير الاعتماديات). التزم بقاعدة الفحص `react-hooks/exhaustive-deps`.‏
  2. **استخدام دالة التحديث الوظيفية** `setX(prev => ...)` عندما تحتاج إلى الحالة السابقة فقط لحساب الحالة التالية.
  3. **استخدام مرجع مع أحدث قيمة (Latest Ref)** (`latestRef.current = value`) عندما تحتاج لقراءة القيمة الحالية دون إعادة الاشتراك في المورد.
  4. استخدام `useEffectEvent` (مستقر في React 19.2): دالة تُستدعى من داخل الـ Effect ترى دوماً أحدث القيم للـ props والـ state دون أن تُعد اعتمادية يُعاد تشغيل الـ Effect بسببها.

## Real-life example
أداة محادثة دعم فني تحتوي على زر تبديل لتفعيل أو كتم الإشعارات الصوتية ("Notify me"). عند وصول رسالة جديدة عبر الـ WebSocket، يجب إصدار صوت تنبيهي فقط إذا كانت الإشعارات مفعلة، مع زيادة عداد الرسائل غير المقروءة. قام المستخدمون **بإيقاف** الصوت، ومع ذلك استمر الصوت بالعمل مع كل رسالة! بالإضافة إلى ذلك، تجمد عداد الرسائل غير المقروءة عند الرقم 1 بغض النظر عن عدد الرسائل الواردة.

```jsx
function SupportChat({ ticketId }) {
  const [soundOn, setSoundOn] = useState(true);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const socket = connectToTicket(ticketId);
    socket.on('message', (msg) => {
      if (soundOn) playPing();       // يقرأ دوماً القيمة الابتدائية: true!
      setUnread(unread + 1);          // يقرأ دوماً 0 + 1 = 1
    });
    return () => socket.disconnect();
  }, []); // خطأ: يستخدم soundOn و unread و ticketId دون التصريح بأي منها في المصفوفة
```
ثلاثة أخطاء برمجية ناتجة عن مصفوفة اعتماديات فارغة واحدة: قيمة `soundOn` قديمة وعالقة، وقيمة `unread` قديمة وعالقة، والـ WebSocket لا يعيد الاتصال عند تبديل المستخدم لتذكرة دعم أخرى.

## How to fix it
```jsx
import { useEffect, useEffectEvent, useState } from 'react';

function SupportChat({ ticketId }) {
  const [soundOn, setSoundOn] = useState(true);
  const [unread, setUnread] = useState(0);

  // يقرأ أحدث قيمة لـ soundOn دائماً، دون أن يكون اعتمادية تفرض إعادة تشغيل الـ Effect
  const onMessage = useEffectEvent(() => {
    if (soundOn) playPing();
  });

  useEffect(() => {
    const socket = connectToTicket(ticketId);
    socket.on('message', () => {
      setUnread((n) => n + 1); // دالة التحديث: لا حاجة لقراءة unread داخل الـ closure
      onMessage();
    });
    return () => socket.disconnect();
  }, [ticketId]); // الاعتمادية التفاعلية الحقيقية الوحيدة: أعد الاتصال فقط إذا تغير ticketId

  // ...بقية كود الـ JSX
}
```
سبب نجاح الحل:
- استدعاء `setUnread(n => n + 1)` يطلب القيمة الحالية مباشرة من React، لذلك لا يحتاج الـ closure لقراءة متغير `unread`.‏
- يوفر `useEffectEvent` دالة تقرأ أحدث قيمة لـ `soundOn`. تبديل خيار الصوت **لا** يعيد فتح اتصال الـ Socket، وهو السلوك المنطقي تماماً لأن تغيير خيار الصوت لا يبرر إعادة الاتصال بالخادم.
- أصبح `ticketId` اعتمادية حقيقية وصريحة، فعند الانتقال لتذكرة جديدة تُنفذ دالة التنظيف (قطع الاتصال السابق) ويتم الاتصال بالتذكرة الجديدة فوراً.

### الحل بدون useEffectEvent (في React 18 أو الإصدارات الأقدم): نمط "Latest Ref"
```jsx
const soundOnRef = useRef(soundOn);
useEffect(() => {
  soundOnRef.current = soundOn; // مزامنة المرجع مع أحدث قيمة بعد كل Commit
}, [soundOn]);

useEffect(() => {
  const socket = connectToTicket(ticketId);
  socket.on('message', () => {
    setUnread((n) => n + 1);
    if (soundOnRef.current) playPing(); // كائنات الـ Refs قابلة للتعديل ومحدثة دوماً
  });
  return () => socket.disconnect();
}, [ticketId]);
```
البديل الأبسط هو وضع `soundOn` في مصفوفة الاعتماديات؛ هذا الحل صحيح منطقياً، ولكنه سيعيد الاتصال بالـ Socket مع كل نقرة على زر الصوت وهو أمر غير مرغوب فيه هنا.

## How to say it in the interview
- "كل دورة تصيير تمتلك الـ Closure الخاص بها. والـ Effect بمصفوفة فارغة `[]` يلتقط قيم أول تصيير فقط، مما يجعل دوال رد النداء المسجلة داخله ترى قيماً قديمة (Stale State). المصفوفة الفارغة ببساطة تكذب بشأن الاعتماديات الحقيقية."
- "استراتيجيتي في الإصلاح: تصحيح مصفوفة الاعتماديات أولاً، ثم استخدام دوال التحديث (Functional updaters)، ثم اللجوء إلى الـ Refs أو `useEffectEvent` للقيم التي أريد قراءتها فقط دون أن أتفاعل مع تغيراتها بإعادة تشغيل الـ Effect."
- فخ شائع: تعطيل قاعدة الفحص `exhaustive-deps` للتخلص من التحذير البرمجي. هذه هي الطريقة الأسرع لتسريب الـ Stale Closures إلى بيئة الإنتاج!
- الموازنة (Trade-off): زيادة الاعتماديات تضمن الصحة ولكنها قد تعيد الاشتراكات بشكل متكرر. والـ Refs تتجنب ذلك لكنها غير تفاعلية، وتغيير قيمتها لا يطلق إعادة تصيير المكون.
