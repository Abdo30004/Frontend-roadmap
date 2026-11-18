# كيف تصمم صفحات ويب متجاوبة (Responsive Web Design)؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- ما هي واجهة المستخدم المتجاوبة (Responsive UI)؟ وكيف تبني تطبيقات متجاوبة؟
- كيف تطبق التصميم المتجاوب في تطبيقات الويب الحديثة؟
- ما هو أسلوبك في بناء تطبيقات متجاوبة تعمل عبر جميع الأجهزة؟

## The concept (short answer)
- يعني التصميم المتجاوب (Responsive Design) وجود كود برمجي واحد يتكيف تخطيطه بسلاسة مع المساحة المتاحة (هواتف، تابلت، حواسيب محمولة، شاشات 4K)، ونوع الإدخال (لمس مقابل فأرة)، وتفضيلات المستخدم (التكبير zoom، تقليل الحركة reduced motion، والوضع الداكن dark mode).
- حجر الأساس هو وسم الميتا لمنفذ العرض: فبدون `<meta name="viewport" content="width=device-width, initial-scale=1">`، تصيّر متصفحات الهواتف صفحة سطح مكتب بعرض 980 بكسل ثم تقلصها فتصبح غير مقروءة.
- ابدأ بأسلوب **الهاتف أولاً (Mobile-first)**: اكتب التنسيقات الأساسية للشاشات الصغيرة أولاً، ثم أضف استعلامات الوسائط بقاعدة `min-width` لتعزيز التجربة للشاشات الأكبر. الشاشات الصغيرة تحصل على أقل قدر من كود CSS وأبسط تخطيط.
- فضّل **الأدوات المرنة (Fluid layout)** على وحدات البكسل الثابتة: `%`، و `fr`، و `rem`، و `()minmax`، و `()clamp`، و `max-width`، و خاصية `flex-wrap` في Flexbox، و `auto-fit` في Grid. وبذلك تتجاوب العديد من التخطيطات دون الحاجة لأي استعلام وسائط.
- **استعلامات الحاوية (Container queries)** عبر `@container`: تتيح للمكون التجاوب مع عرض عنصره الأب بدلاً من الاعتماد على عرض نافذة المتصفح بأكملها، وهو أمر مثالي للبطاقات القابلة لإعادة الاستخدام.
- تجاوب الوسائط والصور: `img { max-width: 100%; height: auto; }`، واستخدام `srcset` و `sizes` أو مكون `<Image>` في Next.js لتفادي تحميل صور بحجم 3000 بكسل على شاشات الهواتف.
- يجب ألا تقل أهداف اللمس (Touch targets) عن ~44x44 بكسل، ويجب الاختبار دائماً على أجهزة حقيقية ووضع المحاكاة في DevTools، ومع تكبير الشاشة بنسبة 200%.

## Real-life example: the problem
تم بناء واجهة قائمة لمطعم بيتزا واختبارها على جهاز كمبيوتر محمول بعرض 1440 بكسل فقط. وعندما فتحها العملاء من هواتفهم، أبلغوا عن:
- اضطرارهم لتكبير الصفحة بالأصابع (pinch-zoom) ليتمكنوا من قراءة القائمة (لغياب وسم viewport).
- ظهور شريط تمرير أفقي لأن شبكة القائمة المكونة من 3 أعمدة كان لكل عمود فيها عرض ثابت `width: 400px`.
- كان زر "Add to cart" رابطاً صغيراً بارتفاع 24 بكسل، كان من الصعب جداً لمسه بالإبهام دون الخطأ.
- كانت الصورة الرئيسية بحجم 2.5 ميجابايت من نوع JPEG، فاستغرقت الصفحة 8 ثوانٍ للتحميل على شبكات 4G.

```html
<!-- index.html: لا يوجد وسم viewport meta -->
<head>
  <title>Pizza Place</title>
</head>
```

```css
/* تصميم مبني لسطح المكتب أولاً، بأبعاد بكسل ثابتة */
.menu {
  display: flex;
}
.menu-item {
  width: 400px;            /* 3 × 400px = 1200px، تتجاوز عرض الهاتف (390px) */
  margin-right: 20px;
}
.add-btn {
  font-size: 12px;
  padding: 4px 6px;        /* مساحة لمس متناهية الصغر */
}
.hero img {
  width: 1600px;           /* لا تنكمش أبداً */
}
@media (max-width: 768px) {
  /* ترقيع مضاف لاحقاً لتخريب التنسيقات السابقة */
  .menu-item { width: 300px !important; }
}
```

## How to fix it
```html
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pizza Place</title>
</head>
```

```css
/* التنسيقات الأساسية بأسلوب الهاتف أولاً (Mobile-first) */
*, *::before, *::after { box-sizing: border-box; }

img { max-width: 100%; height: auto; display: block; }

h1 { font-size: clamp(1.5rem, 4vw + 1rem, 3rem); } /* خط مرن متكيف */

.menu {
  display: grid;
  gap: 1rem;
  /* أكبر عدد ممكن من الأعمدة، كل عمود لا يقل عن 16rem؛ عمود واحد على الهواتف */
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  padding-inline: 1rem;
  max-width: 75rem;
  margin-inline: auto;
}

.menu-item { container-type: inline-size; }

/* تتكيف البطاقة بناءً على عرض حاويتها الخاصة، وليس نافذة المتصفح */
@container (min-width: 22rem) {
  .menu-item__body { display: flex; gap: 1rem; }
}

.add-btn {
  min-height: 44px;
  min-width: 44px;
  padding: 0.75rem 1rem;
  font-size: 1rem;
}

/* ترقية المظهر للشاشات الأكبر */
@media (min-width: 64rem) {
  .layout { display: grid; grid-template-columns: 16rem 1fr; } /* يظهر الشريط الجانبي */
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

```html
<!-- صورة متجاوبة: يختار المتصفح الملف المناسب تلقائياً -->
<img
  src="/hero-800.jpg"
  srcset="/hero-480.jpg 480w, /hero-800.jpg 800w, /hero-1600.jpg 1600w"
  sizes="(min-width: 64rem) 50vw, 100vw"
  alt="Wood-fired margherita pizza"
  loading="eager"
/>
```

لماذا ينجح هذا الحل:
- يجعل وسم viewport بكسلات CSS مطابقة لعرض الجهاز الفعلي، فيرى التخطيط مساحة 390 بكسل حقيقية على iPhone.
- التعبير `repeat(auto-fit, minmax(16rem, 1fr))` ينشئ 1 أو 2 أو 3 أعمدة تلقائياً دون نقاط توقف (breakpoints) ودون فيضان أفقي.
- استعلامات `min-width` بأسلوب الهاتف أولاً تضيف ميزات للشاشات الكبيرة دون صراع مع `!important`.
- السمتان `srcset` و `sizes` تسمحان للهاتف بتحميل صورة بعرض 480 بكسل بدلاً من صورة 1600 بكسل الضخمة.

بدائل أخرى: توفر أطر العمل مثل Tailwind نفس النموذج (`grid-cols-1 md:grid-cols-3`)؛ وفي جافاسكريبت نستخدم `matchMedia` فقط عندما يحتاج السلوك البرمجي نفسه للتغيير (مثل عرض درج جانبي drawer بدلاً من شريط جانبي sidebar).

## How to say it in the interview
- "أبني دائماً بأسلوب الهاتف أولاً (Mobile-first): التنسيقات الأساسية لأصغر شاشة، ثم استعلامات `min-width`، وأعتمد على الوحدات المرنة و Flexbox و Grid لتتكيف أغلب الشاشات دون نقاط توقف ثابتة."
- اذكر وسم viewport meta، والصور المتجاوبة (`srcset` أو Next.js `<Image>`)، واستعلامات الحاوية (container queries) للمكونات؛ فهذا يبرهن على أنك تتجاوز مجرد فكرة "إضافة media queries".
- سؤال المتابعة: "كيف تختار نقاط التوقف (Breakpoints)؟" الإجابة: بناءً على النقطة التي يبدأ فيها المحتوى بالتشوه أو الانهيار، وليس بناءً على مقاسات هواتف معينة؛ مع الاختبار الدائم في DevTools، وعلى أجهزة حقيقية، ومع تكبير الشاشة 200%.
- المفاضلة: إخفاء المحتوى بـ `display: none` على الهواتف يظل يُحمّل بياناته؛ وللمكونات الثقيلة، استخدم التصيير الشرطي أو التحميل الكسول بدلاً من إخفائها بـ CSS فقط.
