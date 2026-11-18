# كيف تدير إعدادات البيئة (Environment Config) دون تسريب الأسرار في حزم الواجهة الأمامية (Bundles)؟

**Level:** Mid
**Merged from (original phrasings):**
- كيف تدير إعدادات البيئة دون الكشف عن المفاتيح السرية في حزم الواجهة الأمامية (Frontend bundles)؟

## The concept
- **قاعدة ذهبية صارمة:** أي كود أو متغير يُشحن إلى متصفح العميل هو محتوى عام ومتاح للجميع. تصغير الكود (Minification) ليس وسيلة حماية أبداً؛ فأي شخص يستطيع فتح أدوات المطور، أو تبويب Sources، أو تحميل ملفات `.js` والبحث فيها عن كلمات مثل `sk_` أو `secret` أو `api_key`.‏
- **كيف تدمج أدوات التجميع متغيرات البيئة:** في وقت البناء (Build time)، تُستبدل استدعاءات مثل `process.env.NEXT_PUBLIC_X` أو `import.meta.env.VITE_X` **بنصوص صريحة ومباشرة (Literal Strings)** داخل كود الجافاسكريبت. والمتغيرات التي تبدأ ببادئة خاصة فقط هي التي يتم تضمينها (مثل `NEXT_PUBLIC_` في Next.js، أو `VITE_` في Vite). هذه البادئة تعني حرفياً: **"اجعل هذا المتغير عاماً ومكشوفاً للجميع"**، ولا تعني مجرد جعله قابلاً للإعداد!
- **الإعدادات العامة (مقبولة داخل الحزمة)**: عناوين الـ API الأساسية العامة، وأعلام الميزات (Feature flags)، ومعرّفات التحليلات (Analytics IDs)، ومفاتيح Stripe *العامة القابلة للنشر (Publishable keys)*، ومعرّف Sentry DSN، ومفاتيح خرائط Google **المقيدة بنطاق الـ HTTP Referrer**.
- **المفاتيح والأسرار (محظور وجودها في الحزمة نهائياً)**: بيانات الاتصال بقواعد البيانات، ومفاتيح Stripe *السرية (Secret keys)*، ومفاتيح الذكاء الاصطناعي (OpenAI/Anthropic)، والرموز المميزة للخدمات، ومفاتيح التشفير والتوقيع. مكان هذه المتغيرات حصراً على الخادم (Route Handlers، Server Components، Server Actions، BFF)، ويقوم المتصفح باستدعاء **نقطة النهاية الخاصة بك**، والتي تتكفل بإضافة المفتاح وفرض المصادقة وتحديد معدل الطلبات (Rate limiting).‏
- **طبقات الدفاع المعمقة**: استخدام حزمة `server-only` لإفشال عملية البناء إذا تم استيراد ملف سري داخل كود العميل بالخطأ. وإضافة أدوات فحص الأسرار (Gitleaks وفحص GitHub) في الـ CI. وإبقاء ملفات `.env*.local` داخل `.gitignore`.‏

## Real-life example
تطبيق ناشئ "لمحرر السيرة الذاتية بالذكاء الاصطناعي" مبني بـ Vite كـ SPA يستدعي مزود LLM مباشرة من متصفح العميل. ولتشغيل التطبيق، وضع المطور المفتاح السري في `VITE_OPENAI_KEY`. وخلال أيام قليلة، اكتشف أحد الأشخاص المفتاح السري داخل الحزمة المجمعة المنشورة في الإنتاج (`assets/index-3f9a.js`) واستخدمه لحساباته الخاصة. تفاجأت الشركة بفاتورة استهلاك تجاوزت عشرات الآلاف من الدولارات واضطرت لحذف المفتاح على عجل مما عطل التطبيق للمستخدمين! كما كشف الكود عن تسريب رمز `VITE_ADMIN_TOKEN` لإدارة النظام.

```bash
# .env (تم رفعه لمستودع Git أيضاً!)
VITE_OPENAI_KEY=sk-proj-abc123...
VITE_ADMIN_TOKEN=adm_9f8e7d...
VITE_API_URL=https://api.resumeai.example.com
```

```js
// src/lib/ai.js: ينفذ في متصفح العميل
export async function improveResume(text) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_OPENAI_KEY}`, // يُدمج كنص مكشوف داخل الحزمة!
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: text }] }),
  });
  return res.json();
}
```

## How to fix it
انقل استدعاء الـ API خلف نقطة نهاية آمنة على خادمك الخاص (باستخدام Next.js Route Handler):‏

```bash
# .env.local (مضاف لـ .gitignore، ومضبوط في خادم الاستضافة للإنتاج)
OPENAI_API_KEY=sk-proj-...           # بدون بادئة، فلن يُدمج في كود العميل مطلقاً
NEXT_PUBLIC_API_URL=https://api.resumeai.example.com   # عام ومكشوف عن عمد
```

```js
// lib/server/ai.js
import 'server-only';                // يعطي خطأ وقت البناء إذا استورده أي كود في العميل

export async function callLLM(messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 800 }),
  });
  if (!res.ok) throw new Error(`خطأ في استدعاء النموذج: ${res.status}`);
  return res.json();
}
```

```js
// app/api/improve-resume/route.js
import { callLLM } from '@/lib/server/ai';
import { getCurrentUser } from '@/server/auth';
import { rateLimit } from '@/server/rate-limit';

export async function POST(req) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  if (!(await rateLimit(`improve:${user.id}`, { max: 20, per: '1h' }))) {
    return Response.json({ error: 'تجاوزت الحد المسموح من الطلبات' }, { status: 429 });
  }
  const { text } = await req.json();
  if (typeof text !== 'string' || text.length > 10_000) return Response.json({ error: 'مدخلات غير صالحة' }, { status: 400 });

  const data = await callLLM([{ role: 'user', content: `حسّن هذه السيرة الذاتية:\n${text}` }]);
  return Response.json({ result: data.choices[0].message.content });
}
```

```js
// العميل: لا يحتوي على أي أسرار، ويستدعي مسار خادمنا الداخلي فقط
const { result } = await fetch('/api/improve-resume', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
}).then(r => r.json());
```
سبب نجاح الحل: المفتاح السري يعيش الآن فقط في متغيرات بيئة الخادم المشفرة، ولن يُدمج أي متغير يفتقر للبادئة العامة في حزم العميل. كما تتيح نقطة نهاية الخادم فرض التحقق من هوية المستخدم، والتحكم بمعدل الاستهلاك (Rate limiting)، والتحقق من حجم النصوص لمنع الاستنزاف المالي.

خطوة حتمية في حال التسريب: **قم بتدوير وإلغاء المفاتيح المسربة فوراً (Rotate keys)**؛ فمجرد حذفها من الكود لا يكفي لأنها تظل مسجلة في تاريخ Git وفي الحزم المخزنة مؤقتاً في شبكات الـ CDN.‏

## How to say it in the interview
- "البادئات مثل `NEXT_PUBLIC_` و `VITE_` تعني صراحة: 'انشر هذا المتغير علناً في كود الجافاسكريبت'. وكل ما يحمل تلك البادئات يصبح عاماً، لذا فإن الأسرار لا تأخذ بادئة أبداً وتُستخدم على جانب الخادم فقط عبر بروكسي أو طبقة BFF."
- "بعض المفاتيح مصممة بطبيعتها لتكون عامة (مثل مفاتيح Stripe العامة ومفاتيح الخرائط)، ووسيلة حمايتها تكمن في ضبط القيود من لوحة تحكم المزود (تقييد الـ HTTP Referrer وحصص الاستخدام) وليس في محاولة إخفائها."
- سؤال متابعة: "كيف تنشر نفس الحزمة في بيئة الاختبار (Staging) والإنتاج (Production)؟" باستخدام إعدادات وقت التشغيل (Runtime config): تقديم ملف `/config.json` أو قراءة المتغيرات على الخادم وتمريرها، بدلاً من تجميد القيم داخل كود الجافاسكريبت وقت البناء.
- فخ شائع: الاعتقاد بأن حذف المفتاح السري من أحدث Commit كافٍ لإصلاح التسريب؛ فالمفتاح يظل موجوداً في سجلات Git والحزم القديمة ويجب تدويره (Rotate) وإلغاؤه فوراً من لوحة المزود.
