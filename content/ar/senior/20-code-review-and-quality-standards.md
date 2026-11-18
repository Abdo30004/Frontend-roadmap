# بناء عمليات مراجعة الكود (Code Review) ومعايير الجودة البرمجية

**Level:** Senior
**Merged from (original phrasings):**
- كيف تبني عمليات مراجعة الكود (Code Review) وتحافظ على معايير الجودة؟

## The concept (short answer)

- **أتمتة كل ما هو آلي وشكلي** ليتفرغ المراجع البشري لمراجعة المعمارية والتصميم وتجربة الاستخدام بدلاً من مناقشة الفواصل المنقوطة: Prettier للتنسيق، و ESLint (مع إضافات `react-hooks` و `jsx-a11y` وقواعد الاستيراد) مع `tsc --noEmit` كـ **فحوصات إلزامية (Required Checks)** في الـ CI، بالإضافة لخطافات ما قبل الـ commit (عبر lint-staged) للتغذية الراجعة السريعة.
- **طلبات سحب صغيرة (Small PRs):** (مثالياً أقل من ~400 سطر معدل) تُراجع أسرع وبدقة أعلى بكثير؛ والميزات الكبيرة تُشحن في شرائح صغيرة خلف أعلام الميزات.
- **قالب مخصص للـ PR (Template):** يُلزم الكاتب بشرح سبب التعديل (Why)، وإرفاق لقطات شاشة، وتأكيد وجود الاختبارات؛ ونظام **CODEOWNERS** لتوجيه المراجعات تلقائياً للمهندسين المسؤولين.
- **قائمة مراجعة موجزة (Review Checklist):** تُركز انتباه المراجع على ما تعجز الأدوات الآلية عن كشفه: صحة المنطق، والحالات الحدية (Edge Cases)، والأمان، وسهولة الوصول (A11y)، والأداء، والتسميات، والتوافق المعماري.
- **حماية الفروع (Branch Protection):** اشتراط موافقة مراجع واحد على الأقل، واجتياز كافة الفحوصات الإلزامية بنجاح، ومنع الدفع المباشر للفرع الرئيسي (main) نهائياً.
- **ثقافة المراجعة:** المراجعة خلال اتفاقية مستوى خدمة متفق عليها (SLA) (مثلاً خلال نفس يوم العمل)، والتعليقات تتسم باللطف والوضوح، مع تصنيفها بحسب مستوى الأهمية (`blocking:` للتعديل الإلزامي، و `suggestion:` للاقتراح الاختياري، و `nit:` للتحسين الشكلي البسيط، و `question:` لطلب الفهم والتوضيح)، مع توجيه النقد للكود وليس للشخص.

## Real-life example: the problem

فريق مكون من 12 مطوراً على لوحة تحكم SaaS. تظل طلبات الـ PR معلقة لثلاثة أيام، ثم تنال موافقة "LGTM" سريعة دون أي فحص متعمق لأن حجمها يتجاوز 2,000 سطر! تتحول خيوط النقاش إلى 40 تعليقاً حاداً حول الفواصل وترتيب الاستيرادات مما يثير النزاعات. تمت الموافقة على PR حذف أحد تبعيات `useEffect` لـ "إيقاف حلقة لا نهائية" فتسبب في عرض بيانات قديمة ومغلوطة في صفحة الفواتير؛ ومرّ PR آخر يحتوي على زر `<div onClick>` يعجز مستخدمو لوحة المفاتيح عن الوصول إليه. والفرع الرئيسي main يتعطل مرتين كل أسبوع لأن أحدهم دفع تعديلاته مباشرة.

```markdown
<!-- .github/pull_request_template.md - BROKEN: empty, so PRs say "fix stuff" -->
```

```json
// package.json - BROKEN: lint exists but nothing enforces it
{
  "scripts": {
    "lint": "eslint src",
    "build": "next build"
  }
}
```
غياب كامل لفحوصات الـ CI الإلزامية، وبدون ملف CODEOWNERS، وبدون حماية للفروع أو توقعات مشتركة.

## How to fix it

**1. أتمتة فحوصات النمط وصحة الكود**
```json
// package.json
{
  "scripts": {
    "lint": "eslint . --max-warnings=0",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "lint-staged": { "*.{ts,tsx}": ["eslint --fix", "prettier --write"] }
}
```
```js
// eslint.config.js (flat config)
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',     // would have caught the stale billing data
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
```
```yaml
# .github/workflows/quality.yml
on: [pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run format:check && npm run lint && npm run typecheck && npm test
```

**2. توجيه ومراقبة مسارات الـ PRs**
```text
# .github/CODEOWNERS
*                       @acme/web-reviewers
/src/features/billing/  @acme/billing-team
/src/design-system/     @acme/design-system
/.github/workflows/     @acme/platform
```
حماية الفرع الرئيسي `main`: اشتراط نجاح فحص `quality`، وموافقة واحدة على الأقل (موافقتان لمجلد `billing/`)، ومراجعة أصحاب الكود المعنيين CODEOWNERS، وتاريخ خطي موحد، ومنع الدفع المباشر تماماً.

**3. قالب PR يفرض السياق بوضوح**
```markdown
<!-- .github/pull_request_template.md -->
## What and why
<!-- Link the ticket. What problem does this solve? -->

## How to test
<!-- Steps, preview URL, test accounts -->

## Screenshots / recordings (UI changes)

## Checklist
- [ ] PR is focused and under ~400 lines (or explains why not)
- [ ] Tests added/updated for new behavior and edge cases
- [ ] Keyboard and screen reader checked for new UI
- [ ] No secrets, no PII in logs; user input is validated/escaped
- [ ] Feature flag used if the change is risky or incomplete
```

**4. إرشادات المراجعة (في ملف CONTRIBUTING.md)**
- الرد الأول خلال يوم عمل واحد؛ واستخدام الاتصال الصوتي أو البرمجة الثنائية إذا تجاوزت الردود ~5 رسائل.
- تصنيف التعليقات ببادئات واضحة: `blocking:` إلزامي، و `suggestion:` اختياري، و `nit:` تفضيل شكلي (غالباً يعني "أضف قاعدة فحص بدلاً من ذلك")، و `question:` أريد الفهم والاستيضاح.
- صياغة الملاحظات كأسئلة واستفسارات مهنية: "هذا الـ Effect يقرأ `accountId` لكنه غير مدرج في التبعيات؛ هل يمكن لصفحة الفواتير أن تعرض بيانات الحساب السابق؟" بدلاً من إطلاق عبارات مثل "هذا الكود خاطئ".
- الإشادة الصريحة بالحلول الإبداعية؛ ومراجعة الكود، لا الشخص.

لماذا ينجح هذا الحل: تتكفل الأدوات الآلية بفرض التنسيقات ورصد أنماط الأخطاء المعروفة، فيتحول وقت المراجع البشري إلى المنطق وتجربة المستخدم والمعمارية؛ وتُقلص الـ PRs الصغيرة مع CODEOWNERS والـ SLA زمن المراجعة جذرياً؛ وتجعل القوائم غياب الاختبارات أو مشاكل الإتاحة مكشوفة قبل الدمج.

## How to say it in the interview

- "أي تعليق يمكن تحويله لقاعدة lint يجب أن يتحول لقاعدة فحص آلية؛ فالمراجعة البشرية مخصصة للصحة المنطقية، والتصميم، والأمان، وتجربة الاستخدام، وسهولة الوصول."
- "أُعطي الأولوية لطلبات السحب الصغيرة ودورات المراجعة السريعة: اتفاقية SLA ليوم عمل واحد، وتوجيه CODEOWNERS، وفحوصات CI إلزامية عبر حماية الفروع."
- فخ المقابلة: "كيف تتعامل مع الخلافات وتباين الآراء؟" - الاحتكام للمعايير المتفق عليها مسبقاً (سجلات القرارات المعمارية ADRs، ودليل الأنماط)؛ وإذا لم تكن هناك قاعدة سابقة، فالقرار يعود لصاحب الـ PR في النقاط غير الإلزامية (non-blocking) مع تدوين القرار لتجنب تكرار الجدل.
- المفاضلة (Trade-off): الإفراط في القواعد والموافقات يُعطل الإنتاجية؛ لذا وازن الصرامة بحسب المخاطر (موافقان لعمليات الدفع والمصادقة، وموافق واحد للتعديلات السطحية).
