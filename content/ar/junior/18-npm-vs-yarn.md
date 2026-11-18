# ما الفرق بين npm و Yarn، وما أهمية ملف الـ lockfile؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- اشرح الفرق بين npm و yarn.

## The concept (short answer)
- كلاهما **مديران للحزم (Package Managers)** في بيئة JavaScript: يقرآن ملف `package.json`، ويحملان الحزم من سجل npm registry، ويثبتانها داخل مجلد `node_modules`، ويشغلان النصوص البرمجية (`npm run dev` / `yarn dev`).
- **npm** يأتي مثبتاً افتراضياً مع Node.js، لذا فهو متاح دائماً دون تثبيت إضافي. وملف التثبيت الخاص به هو `package-lock.json`.
- أنشأت فيسبوك **Yarn** في عام 2016 لمعالجة بطء npm وعدم دقة تثبيتها للحزم في ذلك الوقت. وملف التثبيت الخاص بها هو `yarn.lock`. وإصدار Yarn Classic (v1) في مرحلة الصيانة فقط؛ بينما يوفر Yarn Berry (v2+) ميزة Plug'n'Play (الاستغناء عن مجلد `node_modules`) والتثبيتات الفورية (zero-installs).
- تقلصت الفروقات كثيراً اليوم: يوفر npm الحديث (v7+) ملفات lockfile، ومساحات عمل للمشاريع المتعددة (workspaces)، وتحميلاً متوازياً وسريعاً. وتنحصر الفروقات غالباً في صياغة الأوامر (`npm install x` مقابل `yarn add x`) وصيغة ملف الـ lockfile وميزات الـ monorepo.
- يُعد **pnpm** خياراً ثالثاً شائعاً للغاية اليوم: يستخدم متجراً عالمياً موحداً للحزم على القرص مع روابط صلبة (hard links)، مما يجعله فائق السرعة وموفراً لمساحة التخزين، كما يفرض هيكلاً صارماً لمجلد `node_modules` يمنع استيراد حزم لم تعلن عنها في `package.json` (ما يُعرف بالاعتماديات الشبحية phantom dependencies). وملف التثبيت الخاص به هو `pnpm-lock.yaml`.
- المفهوم الأكثر أهمية على الإطلاق: يقوم **ملف الـ lockfile** بتثبيت الإصدار الدقيق المحلول لكل اعتمادية مباشرة أو فرعية. يقول ملف `package.json` مثلاً `"^4.17.0"` (وهذا نطاق تقريبي)؛ بينما يحدد ملف الـ lockfile الإصدار `4.17.21` بالتمام والكمال. احرص على رفعه دائماً لمستودع الكود، واستخدم أوامر التثبيت النظيفة في بيئة الـ CI.
- اختر **مديراً واحداً فقط** لكل مشروع. وتتيح أداة Corepack مع حقل `packageManager` في `package.json` فرض استخدامه على جميع أفراد الفريق.

## Real-life example: the problem
حالة شائعة من نوع "الكود يعمل على جهازي!": يتم بناء لوحة تحكم React بنجاح تام على أجهزة جميع المطورين، ولكن عملية البناء في خادم الـ CI ونشر الكود في بيئة الإنتاج يفشلان بالخطأ `TypeError: Cannot read properties of undefined` من داخل مكتبة رسوم بيانية. والسبب الجذري:
- كان ملف `package-lock.json` مضافاً إلى `.gitignore` بحجة أنه "يسبب تعارضات دمج مزعجة".
- يستخدم ملف `package.json` رمز القبعة `^` لتحديد الإصدارات، فقامت بيئة الـ CI بتثبيت إصدار فرعي جديد تم نشره للتو لإحدى التبعيات الفرعية وكان يحتوي على خطأ كارثي، بينما احتفظ المطورون محلياً بالإصدار القديم المستقر في مجلد `node_modules`.
- كان أحد المطورين يستخدم Yarn وآخر يستخدم npm، فانفصل ملف `yarn.lock` عن `package-lock.json` وتباعدت النسخ تماماً.

```gitignore
# .gitignore
node_modules/
package-lock.json   # <- هذا هو الخطأ الكارثي
yarn.lock
```

```json
{
  "name": "sales-dashboard",
  "dependencies": {
    "react": "^18.2.0",
    "chart-lib": "^3.1.0"
  }
}
```

```yaml
# خطوة الـ CI الفاشلة
- run: npm install    # تحسب النطاقات من جديد في كل مرة، وتثبت إصدارات أحدث غير متوقعة
- run: npm run build
```

## How to fix it
```gitignore
# .gitignore: تجاهل مجلد الحزم المثبتة فقط، ولا تتجاهل الـ lockfile إطلاقاً
node_modules/
```

```json
{
  "name": "sales-dashboard",
  "packageManager": "npm@10.8.2",
  "engines": { "node": ">=20" },
  "dependencies": {
    "react": "^18.3.1",
    "chart-lib": "^3.1.0"
  }
}
```

```yaml
# خطوة الـ CI الصحيحة
- uses: actions/setup-node@v4
  with: { node-version: 20, cache: npm }
- run: npm ci          # تثبت بدقة ما يحتويه ملف package-lock.json وتفشل إذا وُجد أي تعارض
- run: npm run build
```

الخطوات المتخذة:
1. حذف ملف `yarn.lock` العشوائي، وتوحيد الفريق على مدير حزم واحد، وتتبع ملف `package-lock.json` في المستودع.
2. استخدام أمر `npm ci` في بيئة الـ CI (أو `yarn install --frozen-lockfile` في Yarn v1، أو `yarn install --immutable` في Berry، أو `pnpm install --frozen-lockfile` في pnpm).
3. ترقية الحزم بشكل مدروس ومتعمد (عبر `npm outdated` و `npm update` أو أدوات مثل Dependabot) لتمر النسخ الجديدة عبر المراجعة والـ CI أولاً.
4. حل تعارضات الـ lockfile: حل التعارض في ملف `package.json` أولاً، ثم تشغيل `npm install` لإعادة توليد ملف الـ lockfile تلقائياً؛ وتجنب تعديله يدوياً.

لماذا ينجح هذا الحل: مع تتبع ملف الـ lockfile واستخدام أوامر التثبيت النظيفة، يحصل كل حاسوب محمول، وخادم CI، وبيئة إنتاج على نفس شجرة الاعتماديات المتطابقة تماماً؛ فتتلاشى مشكلة "يعمل على جهازي فقط".

جدول مقارنة الأوامر السريعة:

| المهمة | npm | Yarn | pnpm |
|---|---|---|---|
| تثبيت كافة الحزم | `npm install` | `yarn` | `pnpm install` |
| إضافة حزمة إنتاج | `npm install axios` | `yarn add axios` | `pnpm add axios` |
| إضافة حزمة تطوير | `npm install -D vitest` | `yarn add -D vitest` | `pnpm add -D vitest` |
| التثبيت الصارم في الـ CI | `npm ci` | `yarn install --frozen-lockfile` | `pnpm install --frozen-lockfile` |
| تشغيل أمر برمجي | `npm run build` | `yarn build` | `pnpm build` |
| تشغيل أداة تنفيذية فورية | `npx create-vite` | `yarn dlx create-vite` | `pnpm dlx create-vite` |

## How to say it in the interview
- "يقوم npm و Yarn بنفس المهمة الأساسية: تثبيت الحزم من سجل npm registry وتشغيل الأوامر. تفوق Yarn تاريخياً في السرعة والتثبيت الحتمي، لكن npm الحديث تدارك تلك الفجوة؛ ويحظى pnpm اليوم بشعبية واسعة بفضل سرعته الخارقة وتوفيره للمساحة واعتمادياته الصارمة."
- أكد على أهمية ملف الـ lockfile: احرص على رفعه للمستودع دائماً، واستخدم مدير حزم واحداً فقط للمشروع، وشغّل دائماً أمر `npm ci` (أو نظيره الحتمي) في بيئات الـ CI.
- سؤال المتابعة: "ما الفرق بين `^` و `~` في `package.json`؟" التعبير `^1.2.3` يسمح بالتحديثات الفرعية وتحديثات الإصلاح (<2.0.0)؛ بينما يسمح `~1.2.3` بتحديثات الإصلاح فقط (<1.3.0).
- المفاضلة: صرامة pnpm قد تتطلب تعديلات مع بعض الحزم القديمة التي تفترض رفع الحزم (hoisting) تلقائياً؛ ونظام Plug'n'Play في Yarn يحتاج أحياناً إعدادات إضافية مع بعض أدوات البناء.
