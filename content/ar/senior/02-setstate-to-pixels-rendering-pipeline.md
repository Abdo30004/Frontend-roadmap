# من setState إلى البيكسلات: تحديثات React ومسار التصيير (Rendering Pipeline) في المتصفح

**Level:** Senior
**Merged from (original phrasings):**
- تتبع كل ما يحدث بين استدعاء setState وتغير البيكسلات على الشاشة.
- اشرح مسار التصيير (Rendering Pipeline) في المتصفح: DOM و CSSOM والتخطيط (Layout) والرسم (Paint) والتركيب (Compositing).‏

## The concept (short answer)

**من جانب React**
1. **الجدولة (Schedule):** استدعاء `setState` لا يُطلق التصيير فوراً. بل يضع التحديث في قائمة انتظار (queue) على عقدة الـ fiber الخاصة بالمكون، ويُعيّن له **مساراً (lane)** (تحديث متزامن للنقرات، أو انتقال لـ `startTransition`، ...) ثم يُجدول جذر التطبيق. التحديثات التي تقع في نفس الـ tick يتم **تجميعها في دفعة واحدة (batched)** (في React 18: في كل مكان، بما في ذلك داخل وعود الـ promises والـ timeouts).‏
2. **مرحلة التصيير (Render phase):** تستدعي React مكوناتك، وتطابق عناصر React الجديدة مع شجرة الـ fiber الحالية (Reconciliation)، وتضع علامات (flags) على ما تم تغييره. هذه المرحلة نقية (pure)، لا تلمس شجرة الـ DOM، وقابلة للمقاطعة للمسارات غير العاجلة.
3. **مرحلة الاعتماد (Commit phase - متزامنة):** إجراء تعديلات الـ DOM (إدراج/تحديث/حذف العقد)، وربط المراجع (refs)، ثم تشغيل **`useLayoutEffect`** - وذلك بعد كتابة تعديلات الـ DOM ولكن *قبل* أن يرسم المتصفح الشاشة (قراءة أبعاد التخطيط هنا تُجبر المتصفح على حساب layout متزامن قسري).‏
4. يعمل **`useEffect`** بعد أن تتاح للمتصفح فرصة رسم الإطار على الشاشة (passive effects)، فلا يعطل رسم الإطار. (في React 18 يتم تفريغها بشكل متزامن للمدخلات المباشرة كالنقر).‏

**من جانب المتصفح** (بمجرد أن يُفسح JavaScript المجال للخيط الرئيسي Main Thread)
1. **التحليل (Parse):** تحويل HTML إلى **DOM**، و CSS إلى **CSSOM**.
2. **إعادة حساب الأنماط (Style recalc):** مطابقة المحددات (selectors) وحساب الأنماط لكل عنصر (شجرة التصيير Render Tree = العقد المرئية + الأنماط المحسوبة).‏
3. **التخطيط (Layout أو Reflow):** حساب الهندسة الفراغية - الحجم والموضع لكل صندوق (box).‏
4. **الرسم (Paint):** تسجيل أوامر الرسم (النصوص، الألوان، الحدود، الظلال) داخل طبقات (layers).‏
5. **التركيب (Composite):** يقوم خيط التركيب في كارت الشاشة (GPU Compositor Thread) بتجميع الطبقات في الإطار النهائي المعروض.

النتائج والآثار الهامة: تغيير خصائص مثل `width`/`top`/`font-size` يطلق مسار التخطيط + الرسم + التركيب بالكامل؛ تغيير `color`/`background` يطلق الرسم + التركيب؛ أما تغيير **`transform`/`opacity`** على طبقة مخصصة فيقتصر على **التركيب فقط (composite only)** ويمكن تشغيله مباشرة على خيط الـ compositor حتى لو كان الخيط الرئيسي مشغولاً. وتؤدي **قراءة** خاصية تخطيط هندسية (`offsetHeight`، `getBoundingClientRect`، `scrollTop`) بعد عملية **كتابة** إلى إجبار المتصفح على تشغيل حساب الأنماط والتخطيط بشكل متزامن فوراً - وهو ما يُعرف بـ **Forced Synchronous Layout**؛ وتكرار ذلك داخل حلقة تكرارية يُسمى **Layout Thrashing**.

## Real-life example: the problem

لوحة Kanban لإدارة المشاريع. تقوم كل قائمة بمساواة ارتفاعات البطاقات لتصطف الصفوف بالتوازي، بينما ينزلق درج جانبي عبر تحريك خاصية `left`. بوجود 300 بطاقة، يؤدي فتح اللوحة إلى تجميد المتصفح لمدة ~800ms على اللابتوب وعدة ثوانٍ على الهواتف المتوسطة؛ مع تقطيع شديد في حركة الدرج الجانبي. تُظهر لوحة الأداء (Performance panel) شريطاً أرجوانياً طويلاً لـ "Layout" يتكرر مئات المرات مع تحذير "Forced reflow is a likely performance bottleneck".

```jsx
function Column({ cards }) {
  const listRef = useRef(null);

  useLayoutEffect(() => {
    const nodes = listRef.current.querySelectorAll('.card');
    let max = 0;
    nodes.forEach((node) => {
      node.style.height = 'auto';                 // WRITE  (invalidates layout)
      max = Math.max(max, node.offsetHeight);     // READ   (forces layout NOW)
      node.style.height = `${max}px`;             // WRITE  (invalidates again)
    });
  }, [cards]);

  return <ul ref={listRef}>{cards.map((c) => <li className="card" key={c.id}>{c.title}</li>)}</ul>;
}
```

```css
/* Animating a layout property: layout + paint on every frame, on the main thread */
.drawer { position: fixed; top: 0; left: -400px; width: 400px; transition: left 300ms; }
.drawer.open { left: 0; }
```

تتداخل عمليات الكتابة والقراءة في كل تكرار (Write -> Read)، مما يجعل المتصفح يعيد حساب التخطيط للعمود بأكمله 300 مرة بدلاً من مرة واحدة. ونظراً لأن `left` خاصية تخطيط، يحتاج كل إطار في الأنيميشن إلى حساب تخطيط + رسم على الخيط الرئيسي - وهو بالضبط الخيط المشغول والمختنق.

## How to fix it

قم بتجميع كافة عمليات **القراءة (reads)** أولاً، ثم نفذ جميع عمليات **الكتابة (writes)** (حساب layout واحد بدلاً من N)، واقتصر في التحريك على الخصائص الصديقة للـ compositor.‏

```jsx
function Column({ cards }) {
  const listRef = useRef(null);

  useLayoutEffect(() => {
    const nodes = [...listRef.current.querySelectorAll('.card')];
    nodes.forEach((n) => { n.style.height = 'auto'; });     // all writes
    const heights = nodes.map((n) => n.offsetHeight);      // one forced layout, then cached reads
    const max = Math.max(...heights);
    nodes.forEach((n) => { n.style.height = `${max}px`; }); // all writes
  }, [cards]);

  return <ul ref={listRef}>{cards.map((c) => <li className="card" key={c.id}>{c.title}</li>)}</ul>;
}
```

والأفضل من ذلك هو الاستغناء عن JavaScript تماماً: استخدام CSS Grid مع `grid-auto-rows: 1fr` يُساوي ارتفاعات الصفوف بدون سطر كود JS واحد وبدون أي layout قسري.

```css
.drawer {
  position: fixed; top: 0; left: 0; width: 400px;
  transform: translateX(-100%);
  transition: transform 300ms ease-out;
  will-change: transform; /* promote to its own layer; use sparingly, layers cost memory */
}
.drawer.open { transform: translateX(0); }
```

لماذا ينجح هذا الحل: فصل عمليات القراءة عن الكتابة يعني حساب التخطيط مرة واحدة فقط لكل دورة. ويتم تطبيق خاصية `transform` بواسطة الـ compositor مباشرة على طبقة مرسومة مسبقاً، لذلك تظل حركة الانزلاق بمعدل 60 إطاراً في الثانية (60fps) حتى لو كانت React مشغولة بتصيير محتوى الدرج. ولتنسيق عمليات القراءة والكتابة المعقدة في الـ DOM عبر عدة مكونات، قم بجدولة القراءات في إطار `requestAnimationFrame` والكتابات في الإطار الذي يليه (نمط Fastdom)، أو استخدم `ResizeObserver` بدلاً من استطلاع الأحجام يدوياً.

## How to say it in the interview

- "دالة setState تكتفي بالجدولة فقط؛ حيث تقوم React بالتصيير وحساب الفروقات في مرحلة نقية وقابلة للمقاطعة، ثم تعتمد تعديلات الـ DOM بشكل متزامن، وتُشغل تأثيرات التخطيط layout effects قبل الرسم والتأثيرات السلبية passive effects بعده. بعد ذلك، يتولى المتصفح حساب الأنماط (Style)، والتخطيط (Layout)، والرسم (Paint)، والتركيب (Composite)."
- "أقل التعديلات تكلفة هي تلك التي يستطيع الـ compositor تنفيذها بمفرده: transform و opacity. أما أي تعديل يمس الأبعاد الهندسية فيدفع ثمن إعادة حساب التخطيط والرسم كاملاً."
- فخ المقابلة: استخدام `useLayoutEffect` لقراءة أبعاد التخطيط يُعد forced synchronous layout - وهو أمر مقبول لمرة واحدة، لكنه مدمر للأداء داخل الحلقات التكرارية. سؤال متابعة: "لماذا وُجدت `useLayoutEffect` أصلاً؟" - لقياس العناصر وتصحيح مواقعها قبل الرسم لتجنب الوميض البصري المزعج (visual flicker) مثل تلميحات الأدوات (tooltips) ومواقع النوافذ المنبثقة (popovers).‏
- المفاضلة (Trade-off): خاصية `will-change` وترقية الطبقات تجعل الحركة بالغة النعومة، ولكن كل طبقة تستهلك جزءاً من ذاكرة كارت الشاشة (GPU memory)؛ وترقية مئات العناصر قد تجعل الهواتف الضعيفة أبطأ بدلاً من أن تساندها.
