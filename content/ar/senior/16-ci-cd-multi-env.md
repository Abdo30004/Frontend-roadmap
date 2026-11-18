# تصميم مسار CI/CD للواجهات الأمامية عبر بيئات متعددة

**Level:** Senior
**Merged from (original phrasings):**
- كيف تُصمم مسار تكامل ونشر مستمر (CI/CD) لتطبيقات الواجهة الأمامية عبر بيئات متعددة؟

## The concept (short answer)

- **التكامل المستمر (CI) عند كل طلب سحب (PR):** التثبيت باستخدام ملف القفل (lockfile) والكاش، ثم تشغيل الفحص البرمجي (lint)، وفحص الأنواع (typecheck)، واختبارات الوحدة، والبناء في وظائف متوازية مع الإيقاف السريع عند أي فشل (fail-fast). أضف اختبارات فحص دخاني E2E مقابل **نشر معاينة حي (Preview Deployment)** لكل PR ليتمكن المراجعون وفريق الجودة من تجربة الواجهة الحقيقية.
- **ابنِ الحزمة مرة واحدة، وانشرها في كل مكان (Build once, deploy many):** تُنشر نفس الحزمة البرمجية بالضبط (بنفس تجزئة الـ hash) إلى بيئات التطوير (dev) والتجربة (staging) والإنتاج (prod). وتُحقن الفروقات البيئية (رابط الـ API، ومفتاح Sentry DSN، وأعلام الميزات) عبر **إعدادات وقت التشغيل (Runtime Config)**، وليس عبر إعادة بناء الحزمة بملفات `.env` مختلفة. فإذا أعدت البناء، فإن ما اختبرته في staging ليس هو ما يعمل في production!
- **الترقية بين البيئات (Promotion):** الدمج في الفرع الرئيسي ينشر تلقائياً إلى dev، ثم إلى staging، ثم إلى prod بعد موافقة يدوية مشروطة (عبر بيئات GitHub مع مراجعين معتمدين)، مع حماية كل مرحلة باختبارات دخانية مؤتمتة.
- **التراجع السريع (Rollback):** يجب أن يكون مجرد تغيير مؤشر (إعادة توجيه المسار إلى الحزمة السابقة الثابتة)، ويُنفذ في ثوانٍ معدودة دون إعادة بناء من الصفر.
- تُحفظ الأسرار في مخزن أسرار الـ CI مقيدة لكل بيئة، ولا توضع أبداً في المستودع أو داخل حزمة كود العميل.

## Real-life example: the problem

فريق لوحة تحكم بنكية. اجتاز الإصدار بيئة التجربة (staging) بنجاح، لكن بيئة الإنتاج أظهرت شاشة بيضاء لمدة 40 دقيقة: قام بناء الإنتاج بتشغيل `npm install` (بدون ملف قفل lockfile) فسحب إصداراً فرعياً جديداً غير متوافق لمكتبة تواريخ، كما فُقد المتغير `VITE_API_URL` أثناء خطوة بناء الإنتاج، فأصبح الكود يستدعي الرابط الكارثي `undefined/accounts`. وتطلب التراجع التراجع عن الـ commit وانتظار 15 دقيقة لبناء حزمة جديدة!

```yaml
# .github/workflows/deploy.yml - BROKEN
name: deploy
on:
  push:
    branches: [main, staging, production]   # a branch per environment
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install                       # not reproducible
      - run: npm run build                     # rebuilt per env, env vars baked in
        env:
          VITE_API_URL: ${{ vars.API_URL }}    # empty on 'production' branch
      - run: aws s3 sync dist s3://bank-dashboard-${{ github.ref_name }}
        env:
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_KEY }}
    # no lint, no tests, no typecheck, no approval, no rollback plan
```

## How to fix it

```yaml
# .github/workflows/ci.yml - runs on every PR
name: ci
on: [pull_request]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  checks:
    runs-on: ubuntu-latest
    strategy:
      matrix: { task: [lint, typecheck, 'test -- --coverage'] }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run ${{ matrix.task }}
  preview:
    needs: checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - id: deploy                              # unique preview URL per PR
        run: echo "url=$(npx vercel deploy --yes --token=${{ secrets.VERCEL_TOKEN }})" >> "$GITHUB_OUTPUT"
      - run: npx playwright install --with-deps && BASE_URL=${{ steps.deploy.outputs.url }} npm run e2e:smoke
```

```yaml
# .github/workflows/release.yml - build once on main, promote the same artifact
name: release
on: { push: { branches: [main] } }
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.v.outputs.version }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci && npm run build            # NO environment-specific vars
      - id: v
        run: echo "version=${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"
      - run: aws s3 sync dist s3://artifacts/dashboard/${{ steps.v.outputs.version }}/

  deploy-dev:
    needs: build
    uses: ./.github/workflows/deploy-env.yml
    with: { env: dev, version: '${{ needs.build.outputs.version }}' }
    secrets: inherit
  deploy-staging:
    needs: deploy-dev
    uses: ./.github/workflows/deploy-env.yml
    with: { env: staging, version: '${{ needs.build.outputs.version }}' }
    secrets: inherit
  deploy-prod:
    needs: deploy-staging
    uses: ./.github/workflows/deploy-env.yml   # its job sets `environment: production`
    with: { env: production, version: '${{ needs.build.outputs.version }}' }
    secrets: inherit
```

يُعلن ملف `deploy-env.yml` البيئة المطلوبة `environment: ${{ inputs.env }}` (فتنتظر بيئة الإنتاج موافقة المراجع المعتمد)، ويستخدم بروتوكول OIDC لانتحال دور سحابي دون تخزين مفاتيح سرية دائمة، وينسخ الحزمة الثابتة، ويكتب ملف `config.json` الخاص بتلك البيئة، ويفرغ كاش الـ CDN، ويشغل فحصاً دخانياً.

```ts
// Runtime config: loaded before the app boots, served per environment
// public/config.json on prod: { "apiUrl": "https://api.bank.example", "sentryDsn": "..." }
const config = await fetch('/config.json', { cache: 'no-store' }).then((r) => r.json());
createRoot(document.getElementById('root')!).render(<App config={config} />);
```

**التراجع الفوري (Rollback):** إعادة تشغيل وظيفة `deploy-env` للإنتاج بالإصدار السابق `version` (أو خيار "promote previous deployment" على Vercel/Netlify). لا يتطلب إعادة بناء ويستغرق ثواني فقط.

لماذا ينجح هذا الحل: يضمن `npm ci` مع ملف القفل بناءً متطابقاً وقابلاً للتكرار بنسبة 100%؛ وتضمن الحزمة الموحدة أن ما تم اختباره في staging هو نفسه تماماً ما يعمل في production؛ وتُعامل الإعدادات كبيانات خارجية يتم التحقق من صحتها عند الإقلاع مما يمنع الشاشات البيضاء؛ وتُبنى بوابات الأمان بالموافقات والفحوص الدخانية في كل خطوة.

## How to say it in the interview

- "أبني الحزمة مرة واحدة فقط، وأوسمها برمز الـ commit SHA، وأرقي نفس البايتات عبر بيئات dev و staging و prod؛ وتقتصر الفروقات على إعدادات وقت التشغيل فقط."
- "يحصل كل طلب PR على فحص lint، وفحص أنواع، واختبارات، ورابط معاينة حي مع اختبار دخاني E2E حتى تتم المراجعة على تطبيق حقيقي."
- فخ المقابلة: تقوم أطر العمل مثل Next.js و Vite بحقن متغيرات `NEXT_PUBLIC_*` و `VITE_*` في كود الحزمة أثناء البناء. ولتطبيق مبدأ البناء الموحد تحتاج إما لنقطة نهاية إعدادات وقت التشغيل، أو قراءة البيئة من الخادم، أو استبدال النصوص المؤقتة عند بدء تشغيل الحاوية (Container).
- المفاضلة (Trade-off): تشغيل اختبارات E2E كاملة عند كل PR أمر بطيء وغير مستقر؛ لذا احتفظ بمجموعة اختبارات دخانية خفيفة للـ PRs، واجعل الاختبارات الشاملة تعمل ليلاً أو قبل ترقية الإنتاج.
