# الـ Virtual DOM وعملية الـ Reconciliation ومعمارية React Fiber

**Level:** Senior
**Merged from (original phrasings):**
- اشرح الـ Virtual DOM في React وكيف يساهم في تحسين الأداء.
- ماذا يحدث أثناء عملية الـ Reconciliation في React، وكيف تعمل معمارية Fiber؟

## The concept (short answer)

**ابدأ ببساطة (إجابة مستوى Junior):**
- الـ "Virtual DOM" هو شجرة من كائنات JavaScript البسيطة (React elements) التي تُرجعها المكونات الخاصة بك. إنشاؤها والتخلص منها قليل التكلفة الحوسبية للغاية.
- عند كل تحديث، تبني React شجرة جديدة، وتقارنها بالشجرة السابقة (**عملية الـ Reconciliation**)، وتُطبق فقط الحد الأدنى من التعديلات على شجرة الـ DOM الحقيقية. المكسب ليس أن "الـ Virtual DOM أسرع من الـ DOM الحقيقي" (فهو في الواقع عبء إضافي pure overhead فوق الـ DOM)؛ بل المكسب الحقيقي هو أنك تكتب كوداً تصريحياً "UI = f(state)" بينما تتولى React تجميع (batching) عمليات الكتابة المكلفة في الـ DOM وتقليصها لأدنى حد نيابة عنك.

**تعمق أكثر (إجابة مستوى Senior):**
- **قواعد المطابقة الاستدلالية (Diffing heuristics بتعقيد O(n) بدلاً من O(n^3)):** (1) العناصر ذات **النوع المختلف (different type)** تُنتج شجرة فرعية مختلفة كلياً - تقوم React بإلغاء تركيب (unmount) الشجرة القديمة (تدمير الـ state، وتنظيف الـ effects) وتركيب (mount) الشجرة الجديدة دون مقارنة الأبناء؛ (2) العناصر من **نفس النوع** تجعل React تحتفظ بنسخة المكون وعقدة الـ DOM الحالية وتكتفي بتحديث الـ props فقط؛ (3) **المفاتيح (keys)** تُميّز الأبناء في القوائم عبر دورات التصيير، مما يسمح لـ React بنقل العناصر بدلاً من إعادة إنشائها. استخدام فهارس المصفوفات (index keys) ينهار عند إعادة الترتيب أو الإدراج (حيث تلتصق الـ state بالسطر الخطأ).‏
- **"النوع" يعني الهوية (identity):** وجود `<A/>` مقابل `<B/>` في نفس الموضع، أو تعريف مكون داخل مكون آخر (دالة جديدة مع كل دورة تصيير) يُعد نوعاً جديداً في كل مرة، مما يؤدي لإعادة تركيبه (remount).‏
- **Fiber** هي إعادة كتابة كاملة لمحرك الـ reconciler (بدءاً من React 16). يحصل كل نموذج لمكون على عقدة fiber: وحدة عمل تحتوي على مؤشرات `child` / `sibling` / `return`، مما يمكّن React من التنقل في الشجرة عبر حلقة تكرارية (loop) بدلاً من العودية (recursion)، وبالتالي تستطيع **إيقاف العمل مؤقتاً، أو استئنافه، أو التخلي عنه بالكامل**.
- **التخزين المزدوج (Double buffering):** شجرة `current` هي ما يُعرض حالياً على الشاشة؛ وتبني React شجرة `workInProgress` (مرتبطة بالأولى عبر خاصية `alternate`) ثم تبدّل بينهما فوراً في مرحلة الـ commit.‏
- **مرحلتان رئيسيتان:** **مرحلة التصيير (render phase)** (استدعاء المكونات، حساب الـ diff، ووضع علامات على الـ effects) وهي مرحلة نقية (pure) وقابلة **للمقاطعة (interruptible)** في التصيير المتزامن (concurrent rendering) - ويمكن إعادة تشغيلها، لذا يجب أن تكون المكونات نقية وخالية من الآثار الجانبية. أما **مرحلة الاعتماد (commit phase)** (تعديلات الـ DOM، والمراجع refs، و `useLayoutEffect`، ثم `useEffect`) فهي متزامنة ولا تنقطع أبداً، لضمان ألا يرى المستخدم واجهة غير مكتملة التحديث إطلاقاً.
- **الأولويات والمسارات (Priorities / lanes):** يحصل كل تحديث على lane (قناع بت bitmask): مسار `SyncLane` للمدخلات المباشرة مثل النقرات، والمسار الافتراضي، ومسارات `TransitionLanes` لـ `startTransition`، ومسارات الخمول (idle lanes). يعمل المجدول (scheduler) في شرائح زمنية تقدر بـ ~5ms ثم يعيد التحكم إلى المتصفح؛ ويمكن لتحديث ذي أولوية عالية أن يقاطع عملية تصيير جارية ذات أولوية منخفضة.

## Real-life example: the problem

نموذج لعرض أسعار التأمين. يقوم المستخدم بإدخال الاسم والعنوان وبيانات السيارة، ثم يحدد خيار "Add premium coverage". يتغير نمط الكارت المحيط بالنموذج - و**يتم مسح جميع الحقول التي كتبها المستخدم بالكامل**. تذاكر الدعم الفني تشتكي: "النموذج يحذف بياناتي". لم يلمس أحد الـ state الخاصة بالنموذج؛ بل قام الـ reconciler بما أُمر به بالضبط.

```jsx
function QuoteForm() {
  const [values, setValues] = useState({ name: '', address: '', plate: '' });
  const update = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
  return (
    <>
      <input name="name" value={values.name} onChange={update} />
      <input name="address" value={values.address} onChange={update} />
      <input name="plate" value={values.plate} onChange={update} />
    </>
  );
}

function QuotePage() {
  const [premium, setPremium] = useState(false);

  // BUG 1: the parent type changes, so the whole subtree (and QuoteForm state) is remounted
  const Card = premium ? PremiumCard : BasicCard;

  // BUG 2: a component defined during render is a brand-new type on every render
  const PremiumToggle = () => (
    <input type="checkbox" checked={premium} onChange={(e) => setPremium(e.target.checked)} />
  );

  return (
    <Card>
      <QuoteForm />
      <PremiumToggle />
    </Card>
  );
}
```

ما تراه React عند التبديل: كان الموضع 0 يحتوي على `BasicCard`، والآن أصبح `PremiumCard` - نوع مختلف، لذلك تقوم بهدم `BasicCard` وكل ما تحته، بما في ذلك عقدة fiber الخاصة بـ `QuoteForm` وحالة `useState` التابعة لها. الخطأ الثاني (Bug 2) أكثر دهاءً: دالة `PremiumToggle` تُنشأ كدالة جديدة عند كل دورة تصيير لـ `QuotePage`، لذلك يُعاد تركيب مربع الاختيار (وكل ما بداخله) مع كل ضغطة مفتاح تعيد تصيير المكون الأب، مما يتسبب في فقدان التركيز (focus).‏

## How to fix it

حافظ على **استقرار هيكل الشجرة وأنواع المكونات (tree shape and component types)**؛ وعبّر عن الفروق البصرية عبر الـ props.‏

```jsx
function Card({ variant, children }) {
  return <section className={variant === 'premium' ? 'card card--premium' : 'card'}>{children}</section>;
}

// Defined at module level: stable identity across renders
function PremiumToggle({ checked, onChange }) {
  return <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />;
}

function QuotePage() {
  const [premium, setPremium] = useState(false);
  return (
    <Card variant={premium ? 'premium' : 'basic'}>
      <QuoteForm />
      <PremiumToggle checked={premium} onChange={setPremium} />
    </Card>
  );
}
```

لماذا ينجح هذا الحل: يمتلك العنصر في كل موضع الآن نفس النوع قبل وبعد التبديل، لذلك تعيد React استخدام عقد الـ fibers الموجودة بالفعل وتكتفي بتعديل خاصية `className`. تعيش حالة `QuoteForm` داخل عقدة الـ fiber الخاصة بها، والتي تظل حية ومحفوظة.

البدائل: إذا كان لابد حقاً من اختلاف المكونين في التخطيطين، **ارفع حالة النموذج للأعلى (lift state up)** (أو ضعها في مكتبة إدارة نماذج أو في الرابط URL) حتى تنجو من إعادة التركيب. واستخدم نفس هذه القاعدة عمداً عندما *تريد* إعادة التعيين: وضع `<QuoteForm key={customerId} />` يتخلص من الحالة تلقائياً عند تغيير العميل.

المفاتيح (keys) في القوائم تتبع نفس المنطق:

```jsx
// BAD: delete row 0 and row 1's typed note now shows in the wrong row
{drivers.map((d, i) => <DriverRow key={i} driver={d} />)}
// GOOD: identity follows the data
{drivers.map((d) => <DriverRow key={d.id} driver={d} />)}
```

## How to say it in the interview

- "الـ Virtual DOM ليس أسرع من الـ DOM الحقيقي؛ بل يسمح لـ React بحساب الحد الأدنى من التعديلات استناداً إلى وصف تصريحي. وتعتمد المطابقة (Reconciliation) على خوارزمية مقارنة استدلالية بتعقيد O(n): اختلاف النوع يعني إعادة تركيب كاملة، وتطابق النوع يعني تحديث الخصائص فقط، بينما تمنح المفاتيح هوية ثابتة لعناصر القوائم."
- "تُحوّل معمارية Fiber شجرة المكونات إلى قائمة مترابطة (linked list) من وحدات العمل. مرحلة التصيير (render phase) قابلة للمقاطعة وتُدار بالأولويات عبر مسارات lanes؛ أما مرحلة الاعتماد (commit phase) فهي متزامنة لضمان عدم تطبيق الواجهة بشكل جزئي أو مشوه."
- فخ / سؤال متابعة: "لماذا أُعيد تعيين حالة النموذج لدي؟" - بسبب تغير نوع المكون في ذلك الموضع (غلاف شرطي conditional wrapper، أو تعريف مكون داخل دالة التصيير، أو تغير الـ `key`). وأيضاً: نظراً لأن دالة التصيير قد تعمل أكثر من مرة ويتم التخلص من نتيجتها، فإن وضع أي آثار جانبية (side effects) داخل الـ render يُعد خطأ برمجياً فادحاً - ولهذا السبب يستدعي وضع StrictMode المكونات مرتين لكشف ذلك.
- المفاضلة (Trade-off): تُضحي القواعد الاستدلالية بدقة المقارنة المطلقة لصالح السرعة الفائقة - لن تكتشف React انتقال شجرة فرعية إلى أب مختلف؛ بل ستعيد تركيبها. لذلك احرص على هيكلة شجرة المكونات بحيث تظل العناصر الثابتة في مواقع مستقرة.
