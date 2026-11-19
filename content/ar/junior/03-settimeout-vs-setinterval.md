# ما الفرق بين setTimeout و setInterval في JavaScript؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- ما الفرق بين setTimeout و setInterval؟

## The concept (short answer)
- تقوم `setTimeout(fn, delay)` بتنفيذ الدالة `fn` **مرة واحدة فقط**، بعد مرور `delay` مللي ثانية على الأقل. ويمكن إلغاؤها عبر `clearTimeout(id)`.‏
- تقوم `setInterval(fn, delay)` بتنفيذ الدالة `fn` **بشكل متكرر**، كل `delay` مللي ثانية، حتى تستدعي `clearInterval(id)`.‏
- تُرجع كلتا الدالتين معرفاً (ID)، وتتم جدولتهما عبر المتصفح وإرسالهما إلى **طابور المهام (task queue)**. لا تعمل دالة رد النداء إلا بعد أن يفرغ مكدس الاستدعاءات (call stack)، لذلك فإن قيمة التأخير تمثل **الحد الأدنى** وليست ضماناً دقيقاً. كما أن انشغال الخيط الرئيسي (main thread) أو عمل التبويب في الخلفية يؤدي لتأخيرهما.
- لا تنتظر `setInterval` انتهاء عملك البرمجي؛ فإذا بدأت دالة رد النداء طلباً غير متزامن يستغرق وقتاً أطول من الفترة المحددة، فستتراكم الطلبات وتتداخل مع بعضها (**pile up and overlap**).‏
- استخدام **`setTimeout` التكراري (recursive `setTimeout`)** (جدولة التنفيذ التالي عند نهاية التنفيذ الحالي) يضمن وجود فاصل زمني حقيقي بين العمليات وهو الأسلوب الأكثر أماناً للاستقصاء الدوري (polling).‏
- التنظيف الدائم ضرورة حتمية: المؤقت المنسي يستمر بالعمل حتى بعد مغادرة المستخدم للصفحة أو إلغاء تركيب المكون (unmount).‏

```js
const id1 = setTimeout(() => console.log('مرة واحدة بعد ثانية'), 1000);
const id2 = setInterval(() => console.log('كل ثانية'), 1000);
clearInterval(id2); // إيقاف المؤقت
```

## Real-life example: the problem
تخيّل لوحة تحكم مصرفية تقوم بتحديث رصيد الحساب كل 5 ثوانٍ. على شبكة هاتف محمول بطيئة، قد يستغرق طلب `/api/balance` نحو 8 ثوانٍ أحياناً. لاحظ المستخدمون أن الرصيد **يقفز ذهاباً وإياباً** بين القيم القديمة والجديدة، ولاحظ فريق الواجهة الخلفية ارتفاعاً هائلاً ومفاجئاً في حركة البيانات (traffic spikes). علاوة على ذلك، عندما ينتقل المستخدم لصفحة أخرى داخل تطبيق React، أظهر تبويب الشبكة أن الطلبات **مستمرة للأبد** دون توقف، ومع تكرار زيارة الصفحة بدأت عدة مؤقتات تستعلم في آن واحد.

الخطآن البرمجيان: تطلق `setInterval` طلبات جديدة بينما الطلبات السابقة ما زالت معلقة (فتصل الاستجابات بترتيب عشوائي غير متطابق)، كما لم يتم تنظيف المؤقت مطلقاً عند إزالة المكون.

```jsx
// BROKEN: BalanceCard.jsx
import { useEffect, useState } from 'react';

export function BalanceCard({ accountId }) {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    setInterval(async () => {
      const res = await fetch(`/api/accounts/${accountId}/balance`);
      const data = await res.json();
      setBalance(data.amount); // الاستجابة القديمة البطيئة قد تكتب فوق استجابة أحدث منها
    }, 5000);
    // غياب التنظيف -> المؤقت يستمر بالعمل للأبد حتى بعد الـ unmount
  }, [accountId]);

  return <p>Balance: {balance ?? 'Loading...'}</p>;
}
```

## How to fix it
استخدم دالة `setTimeout` تكرارية: انتظر حتى ينتهي الطلب بالكامل، ثم جدول الطلب التالي. مع إلغاء المؤقت في دالة تنظيف الـ effect.‏

```jsx
// FIXED: BalanceCard.jsx
import { useEffect, useState } from 'react';

export function BalanceCard({ accountId }) {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    let timeoutId;
    let stopped = false;

    async function poll() {
      try {
        const res = await fetch(`/api/accounts/${accountId}/balance`);
        const data = await res.json();
        if (!stopped) setBalance(data.amount);
      } catch (err) {
        console.error('Balance refresh failed', err);
      } finally {
        if (!stopped) {
          timeoutId = setTimeout(poll, 5000); // يبدأ الاستدعاء التالي بعد 5 ثوانٍ من اكتمال الحالي
        }
      }
    }

    poll(); // التحميل الأول فوراً

    return () => {
      stopped = true;
      clearTimeout(timeoutId); // إيقاف الاستقصاء عند الـ unmount أو تغير accountId
    };
  }, [accountId]);

  return <p>Balance: {balance ?? 'Loading...'}</p>;
}
```

لماذا ينجح هذا الحل: يوجد طلب واحد فقط قيد التنفيذ في أي وقت، وبالتالي يستحيل وصول الاستجابات بترتيب غير صحيح. ويوقف المؤشر `stopped` مع `clearTimeout` أي عمليات بمجرد إلغاء تركيب المكون أو تغير `accountId`.‏

متى تكون `setInterval` مناسبة: للعمليات المتزامنة القصيرة التي لا تحتمل خطر التداخل، مثل ساعات العد التنازلي (مع الحرص على تنظيفها). وللبيانات اللحظية، يُفضل دائماً استخدام WebSockets أو مكتبات إدارة البيانات (مثل TanStack Query مع `refetchInterval`) بدلاً من الاستقصاء اليدوي.

## How to say it in the interview
- "`setTimeout` تُنفذ مرة واحدة بعد حد أدنى من التأخير، بينما `setInterval` تتكرر دورياً حتى إلغائها. وكلتاهما تمثلان حداً أدنى للتأخير فقط لأن دوال رد النداء تنتظر في طابور المهام حتى فراغ مكدس الاستدعاءات."
- "لاستقصاء الـ APIs دورياً، أفضّل دائماً `setTimeout` التكراري، لأن `setInterval` لا تنتظر انتهاء العمليات غير المتزامنة مما يسبب تداخل الطلبات."
- الفخ الشائع: نسيان `clearInterval` أو `clearTimeout` في دالة تنظيف `useEffect` يسبب تسريباً في الذاكرة ومؤقتات مكررة (وهو أمر يظهر بوضوح في React StrictMode التي تُركب الـ effects مرتين في بيئة التطوير).‏
- سؤال المتابعة: "لماذا ينحرف المؤقت عن الوقت الحقيقي (drift)؟" لأن كل دورة قد تتأخر قليلاً، لذا في تطبيقات الساعات يُحسب الوقت دائماً بالاعتماد على `Date.now()` بدلاً من عد دورات المؤقت.
