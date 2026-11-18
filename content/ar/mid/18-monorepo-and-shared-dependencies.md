# ما هو الـ Monorepo، وكيف تدير الاعتماديات المشتركة داخله؟

**Level:** Mid
**Merged from (original phrasings):**
- ما هو الـ Monorepo؟
- ما هي طريقتك واستراتيجيتك لإدارة الاعتماديات المشتركة في الـ Monorepo؟

## The concept
- الـ **Monorepo** هو مستودع Git موحد يضم بداخله مشاريع وتطبيقات وحزم متعددة، مثل `apps/web`، و `apps/admin`، و `packages/ui`، و `packages/utils`، و `packages/eslint-config`. يختلف هذا المفهوم كلياً عن النظام المتجانس القديم (**Monolith**)؛ فالمشاريع في الـ Monorepo تظل مستقلة تماماً في البناء والنشر.
- **المزايا**: إجراء تغييرات ذرية موحدة عبر الحزم (Atomic changes: تعديل مكون وتحديث كافة التطبيقات المستهلكة له في Pull Request واحد)، ومشاركة أدوات البناء والإعدادات، وعدم الحاجة لنشر الحزم الداخلية على npm لاستخدامها، وسهولة إعادة هيكلة الكود (Refactoring).‏
- **التكاليف والتحديات**: يجب أن تكون خطوط الأنابيب (CI) ذكية (تبني وتختبر ما تغير فقط)، وتضخم حجم المستودع، وضرورة الانضباط الصارم في إدارة الاعتماديات.
- **أدوات العمل الأساسية**: ميزة مساحات العمل (Workspaces في pnpm أو npm أو Yarn) لربط الحزم المحلية ببعضها. ومشغلات المهام المتقدمة مثل **Turborepo** أو **Nx** لتشغيل المهام وفق شجرة الاعتماديات، مع التخزين المؤقت للنتائج محلياً وعن بُعد، واستخدام أوامر الفحص (`--filter` أو `affected`) لتشغيل ما تأثر فقط.
- **استراتيجية إدارة الاعتماديات المشتركة**:
  - الحزم والمكتبات المشتركة مثل `packages/ui` تصرح بـ `react` و `react-dom` كـ **peerDependencies** ("التطبيق النهائي هو من يوفر نسخة React") و كـ devDependencies لاختباراتها الداخلية، وتتجنب وضعهما نهائياً كـ dependencies عادية.
  - الحفاظ على **نسخة موحدة واحدة** لكل إطار عمل في المستودع: باستخدام ميزة `catalog:` في pnpm، أو أداة `syncpack`، أو مجموعات Renovate. وتمنع بنية `node_modules` الصارمة في pnpm مشكلة "الاعتماديات الشبحية" (Phantom dependencies).‏
  - استخدام `"workspace:*"` للحزم الداخلية لضمان الإشارة دائماً للكود المصدري المحلي داخل المستودع.

## Real-life example
يحتوي مستودع Monorepo لشركة على تطبيق الويب `apps/web` (يعمل بـ React 19) ومكتبة واجهة المستخدم `packages/ui` (نظام التصميم Design System). قام أحد المطورين بإضافة `react` داخل حقل **dependencies** في `packages/ui` بإصدار مختلف. بعد التثبيت، انهار تطبيق الويب في كل صفحة تستخدم مكون القائمة المنسدلة `<Dropdown>` مع رسالة الخطأ الشهيرة:

```
Invalid hook call. Hooks can only be called inside of the body of a function component.
... 3. You might have more than one copy of React in the same app
```

أصبح هناك نسختان متزامنتان من React في نفس التطبيق: `node_modules/react` (التي يستخدمها التطبيق) و `packages/ui/node_modules/react` (التي تستخدمها حزمة الواجهة). تستدعي خطافات المكون `<Dropdown>` نسخة React مختلفة لم يقم الـ renderer بتهيئة الـ dispatcher الخاص بها، فتفشل الاستدعاءات وتصبح الـ Context Providers المعرفة في التطبيق غير مرئية لمكونات حزمة الواجهة!

```jsonc
// packages/ui/package.json (معطوب)
{
  "name": "@acme/ui",
  "version": "1.0.0",
  "main": "src/index.ts",
  "dependencies": {
    "react": "^18.2.0",          // تثبيت نسخة ثانية مختلفة من React خصيصاً لهذه الحزمة!
    "react-dom": "^18.2.0",
    "clsx": "^2.1.0"
  }
}
```

```jsonc
// apps/web/package.json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@acme/ui": "1.0.0"          // قد تُجلب من npm بدلاً من الحزمة المحلية
  }
}
```
أظهر أمر التشخيص `pnpm why react` وجود نسختين مختلفتين من React محملتين معاً.

## How to fix it
```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
catalog:
  react: ^19.0.0
  react-dom: ^19.0.0
  typescript: ^5.6.0
```

```jsonc
// packages/ui/package.json (تم الإصلاح)
{
  "name": "@acme/ui",
  "private": true,
  "main": "src/index.ts",
  "peerDependencies": {
    "react": "^18.3.0 || ^19.0.0",
    "react-dom": "^18.3.0 || ^19.0.0"
  },
  "devDependencies": {
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "dependencies": {
    "clsx": "^2.1.0"
  }
}
```

```jsonc
// apps/web/package.json (تم الإصلاح)
{
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:",
    "@acme/ui": "workspace:*"     // دائماً الحزمة المحلية من مساحة العمل
  }
}
```

```jsonc
// turbo.json: بناء الحزم قبل التطبيقات وتخزين المخرجات وتشغيل المتأثر فقط في الـ CI
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "test":  { "dependsOn": ["^build"] },
    "lint":  {}
  }
}
```

في الـ CI: يشغل أمر `pnpm turbo run build test lint --filter=...[origin/main]` الفحص والاختبار للحزم التي طرأ عليها تغيير منذ تفريع `main` وتطبيقاتها المتأثرة فقط.

سبب نجاح الحل: بتحديد React كـ Peer Dependency، تُحل النسخة مباشرة من التطبيق المستهلك النهائي، فتوجد نسخة واحدة فقط من React في الذاكرة وتعمل الخطافات والـ Contexts بانسجام تام. ويوحد كائن `catalog` الإصدار في مكان مركزي واحد.

## How to say it in the interview
- "الـ Monorepo هو مستودع واحد يحتوي على عدة مشاريع مستقلة النشر. تتكفل الـ Workspaces بالربط المحلي، وتتولى أدوات مثل Turborepo أو Nx تنسيق المهام والتخزين المؤقت وحصر فحوصات الـ CI على المشاريع المتأثرة فقط."
- "المكتبات أحادية المثيل (Singletons) مثل React أو مكتبات الـ CSS-in-JS أو الموجهات (Routers) توضع دائماً في `peerDependencies` للحزم المشتركة؛ وإلا واجهت مشكلة تعدد النسخ وخطأ 'Invalid hook call' الكلاسيكي."
- سؤال متابعة: "كيف تمنع الفرق من استيراد الملفات الداخلية لحزم أخرى عشوائياً؟" عبر حقول `exports` في `package.json`، وقواعد حدود الحزم في Nx أو قاعدة ESLint `no-restricted-imports`، مع تعيين ملف CODEOWNERS لكل حزمة.
- الموازنة (Trade-off): سياسة الإصدار الموحد تجعل الترقيات شاملة (ترقية React تتطلب فحص كل التطبيقات معاً)، لكن هذا أسهل بكثير من كابوس تصحيح تباعد وتضارب الإصدارات في المستودعات المنفصلة.
