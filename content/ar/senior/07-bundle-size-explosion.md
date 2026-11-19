# التحقيق في تضخم حجم الـ Bundle وحلها

**Level:** Senior
**Merged from (original phrasings):**
- تضخم حجم حزمة JavaScript من 500 كيلوبايت إلى 5 ميجابايت. من أين تبدأ؟
- تضاعف حجم الـ Bundle وانخفضت مؤشرات Core Web Vitals فجأة. من أين تبدأ؟

## The concept (short answer)

- **قِس بدقة قبل التخمين:** قم بالبناء باستخدام أداة تحليل الحزم (`@next/bundle-analyzer`، أو `webpack-bundle-analyzer`، أو `rollup-plugin-visualizer` لـ Vite، أو `source-map-explorer`) وافحص الخريطة الشجرية (treemap) للحزمة الأولية (initial chunk) لكل مسار. وقارن النتائج بآخر بناء سليم (`git bisect` على حجم الحزمة إذا لزم الأمر).‏
- **المتهمون المعتادون، مرتبين حسب الشيوع والتكرار:**
  1. **استيراد المكتبات بالكامل:** مكتبة `moment` (+ كافة ملفات اللغات locales)، أو استيراد `import _ from 'lodash'` (بصيغة CommonJS غير القابلة للـ Tree-shaking)، أو حزم الأيقونات الكاملة، أو `aws-sdk` v2.‏
  2. **ملفات التصدير الشاملة (Barrel files)** (`index.ts` الذي يُعيد تصدير كل شيء) والتي تسحب مجلدات بأكملها، خاصة إذا كان أي موديول يحتوي على آثار جانبية (side effects)، مما يُعطل خوارزمية الـ tree-shaking تماماً.
  3. **المكونات الثقيلة المحملة مبكراً (Eagerly loaded):** مكتبات الرسوم البيانية، ومحررات النصوص المنسقة (rich-text editors)، وقارئات PDF، والخرائط المستخدمة في نافذة منبثقة (modal) واحدة أو مسار فرعي واحد.
  4. **التبعيات المكررة:** وجود نسختين مختلفتين من نفس المكتبة بسبب تضارب إصدارات semver (يكشفها أمر `npm ls <pkg>`، وتظهر مرتين في أداة التحليل).‏
  5. **تسرب كود الخادم إلى العميل:** وضع توجيه `"use client"` في موضع شديد الارتفاع في شجرة Next.js، أو موديول مشترك يستورد SDK ضخماً.
- **لماذا يُدمر ذلك مؤشرات Web Vitals:** كود JavaScript هو أثقل وأغلى بايت تنقله عبر الشبكة - يتطلب تنزيلاً، ثم تحليلاً وترجمة وتنفيذاً على الخيط الرئيسي. وتؤدي الحزم الضخمة إلى تأخير الترطيب (مما يضر بمقياس INP وسرعة التفاعل) وكثيراً ما تؤخر مقياس LCP عندما يعتمد العنصر الرئيسي على تشغيل الـ JS.‏
- **منع الانتكاسات:** فرض ميزانية للحجم في الـ CI (باستخدام `size-limit` أو `bundlewatch`) لإفشال طلب الـ PR تلقائياً والتعليق بتقرير الفروقات.

## Real-life example: the problem

لوحة تحكم تحليلات لخدمة SaaS. خلال ربعين سنويين، قفزت الحزمة الرئيسية من 500 كيلوبايت إلى 5 ميجابايت (1.4 ميجابايت بصيغة gzip). وأظهرت بيانات المستخدمين الفعليين (Field data) أن مقياس INP على الهواتف تدهور من "جيد" إلى 450ms، وتراجع مقياس LCP بمقدار ثانيتين على صفحة تسجيل الدخول - التي لا تحتوي إلا على نموذج إدخال بسيط! كشفت خريطة التحليل الشجرية عن وجود `moment` بـ 160 ملف لغة، ومكتبة lodash كاملة مرتين (lodash العادية + lodash-es)، ومكتبة `echarts` بالكامل، ومحرر Monaco editor في حزمة البداية الأولية.

```js
// utils/date.js
import moment from 'moment';                       // ~290 KB with locales
export const fmt = (d) => moment(d).format('DD MMM YYYY');

// utils/array.js
import _ from 'lodash';                            // entire CJS lodash (~70 KB min)
export const uniqBy = (arr, k) => _.uniqBy(arr, k);

// components/index.ts  (barrel)
export * from './Button';
export * from './Input';
export * from './RevenueChart';                    // imports 'echarts' (whole build)
export * from './SqlEditor';                       // imports 'monaco-editor'

// app/login/page.tsx
import { Button, Input } from '@/components';     // login now depends on echarts + monaco
```

```json
{
  "dependencies": { "date-fns": "^2.30.0", "some-ui-kit": "^4.1.0" }
}
```

(تعتمد `some-ui-kit` على `date-fns@^3`، فيتم شحن كلا الإصدارين للمستخدم).‏

## How to fix it

1. حدد المشكلة بالأرقام: `ANALYZE=true next build` (أو `npx vite-bundle-visualizer`) مع `npm ls date-fns lodash`.‏
2. استبدل الاستيرادات وضيّق نطاقها:

```js
// utils/date.js - native Intl, zero KB
const fmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
export const formatDate = (d) => fmt.format(new Date(d));

// utils/array.js - ESM, tree-shakeable, one function
import uniqBy from 'lodash-es/uniqBy';
export { uniqBy };
```

3. الاستيراد المباشر من المسار بدلاً من ملف الـ barrel (أو تكوين إطار العمل ليُعيد كتابتها)، والتحميل الكسول للمكونات الثقيلة:

```tsx
// app/login/page.tsx
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

// app/reports/RevenueSection.tsx
'use client';
import dynamic from 'next/dynamic';
const RevenueChart = dynamic(() => import('@/components/RevenueChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const SqlEditor = dynamic(() => import('@/components/SqlEditor'), { ssr: false });
```

```js
// next.config.js - rewrites barrel imports to direct paths at build time
module.exports = {
  experimental: { optimizePackageImports: ['@/components', 'lucide-react'] },
};
```

```jsonc
// package.json of the internal components package: tells the bundler unused modules can be dropped
{ "sideEffects": ["*.css"] }
```

4. إزالة التكرار: ترقية حزمة `date-fns` الخاصة بنا لنفس الإصدار الرئيسي المستخدم في مكتبة الواجهة (أو استخدام `overrides`/`resolutions`)، ثم تشغيل `npm dedupe`.‏

5. تثبيت المعايير عبر ميزانية CI صارمة:

```json
{
  "scripts": { "size": "size-limit" },
  "size-limit": [
    { "name": "login route", "path": ".next/static/chunks/app/login/*.js", "limit": "120 KB" },
    { "name": "shared framework", "path": ".next/static/chunks/framework-*.js", "limit": "60 KB" }
  ]
}
```

```yaml
# .github/workflows/size.yml
- run: npm ci && npm run build
- run: npx size-limit          # fails the PR when a budget is exceeded
```

لماذا ينجح هذا الحل: تُحول أداة التحليل التخمين إلى قائمة مرتبة بالأولويات؛ وتتخلص واجهات `Intl` الأصلية واستيرادات ESM الجزئية من الأوزان الميتة؛ وتسمح الاستيرادات المباشرة وخاصية `sideEffects` بعمل الـ tree-shaking بفاعلية؛ وينقل `dynamic()` المحررات والرسوم البيانية إلى حزم لا تُحمّل إلا عندما يفتح المستخدم تلك الشاشات فعلياً؛ بينما تكشف ميزانية الحجم في الـ CI أي انتكاسة مستقبلية في نفس الـ PR المسبب لها فوراً.

## How to say it in the interview

- "أنا لا أخمّن أبداً: أبدأ بأداة التحليل (analyzer)، وأفحص الحزمة الأولية للمسار الأسوأ، وأقارنها بآخر بناء سليم. ثم أستهدف العناصر الثلاثة الأولى الأكبر حجماً."
- "المتسببون الشائعون هم استيراد المكتبات بالكامل، وملفات الـ barrel التي تُعطل الـ tree-shaking، والمكونات الثقيلة غير المقسمة، والتبعيات المكررة؛ وتتمثل الحلول في تضييق الاستيرادات، وتقسيم الكود بحسب المسار والتفاعل، وإزالة التكرار (dedupe)، وفرض ميزانية حجم في الـ CI."
- فخ المقابلة: الحجم المضغوط (gzipped size) ليس المقياس الحقيقي للتكلفة - فحزمة بحجم 400 كيلوبايت مضغوطة قد تمثل 1.5 ميجابايت من كود JS غير المضغوط الذي يحتاج المتصفح لتحليله وتنفيذه على هاتف بطيء. يجب قياس زمن التنفيذ الفعلي أيضاً.
- المفاضلة (Trade-off): الإفراط في تقسيم الكود (over-splitting) يخلق عدداً هائلاً من طلبات الشبكة الصغيرة ومؤشرات تحميل مزعجة عند كل نقرة؛ لذا قسّم الكود عند حدود المسارات والمكونات الثقيلة نادرة الاستخدام، واستخدم الجلب المسبق (prefetch) للحزم المتوقع طلبها قريباً.
