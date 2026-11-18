# معمارية الـ Micro-frontends مع عمليات النشر المستقلة

**Level:** Senior
**Merged from (original phrasings):**
- كيف تُصمم معمارية Micro-frontends تدعم عمليات النشر المستقلة؟

## The concept (short answer)

- تُقسم معمارية الـ Micro-frontends واجهة المنتج الواحد إلى تطبيقات منفصلة يمتلك كل منها فريق مستقل، بمستودع كود (repo) ومسار نشر (pipeline) خاص به، وتُنشر باستقلالية تامة، ليتم تجميعها في وقت التشغيل (runtime) عبر **تطبيق غلاف مضيف (Host/Shell)**.
- الآلية الشائعة لوقت التشغيل هي **اتحاد الموديولات (Module Federation)** (في Webpack 5 و Rspack و `@module-federation/vite`): يُحمّل المضيف ملف `remoteEntry.js` الخاص بالتطبيق البعيد عبر رابط URL في وقت التشغيل، مما يسمح بنشر التعديل دون إعادة بناء الغلاف المضيف.
- **النسخ المشتركة المفردة (Shared Singletons):** المكتبات الأساسية (مثل React و React DOM والموجّه Router ونظام التصميم Design System) يجب أن تُعلن كـ `shared: { singleton: true }` مع نطاق إصدارات متوافق، وإلا فستحصل على نسختين من React مما يؤدي لانهيار الـ Hooks والـ Context فوراً.
- تتواصل التطبيقات عبر **عقد موثق ومحدد الإصدار (Versioned contract)**: وهو props المكون الممرر، أو أحداث مخصصة (Custom Events) أو ناقل أحداث نمطي (typed event bus)، والرابط URL. وتجنب تماماً استيراد ملفات داخلية لفرق أخرى أو مشاركة مخزن حالة عام (Global store).
- **عزل ملفات التنسيق (CSS isolation):** استخدام CSS Modules أو بادئات الفئات (prefixed classes) أو CSS-in-JS بأسماء معزولة، أو Shadow DOM في الحالات القصوى؛ وتجنب إطلاق أي تنسيقات عامة (global resets) من التطبيقات البعيدة.
- **متى تتجنب استخدامها:** إذا كان لديك فريق أو فريقان فقط، أو تطبيق صغير، أو لا توجد حاجة تنظيمية حقيقية لجدول نشر مستقل لكل فريق. فالـ Micro-frontends تُضيف تكلفة حوسبية عند التشغيل، وأخطاء تضارب الإصدارات، وتعقيداً تشغيلياً هائلاً؛ وغالباً ما يكون مستودع الكود الموحد (Monorepo) حسن التنظيم خياراً أفضل بكثير.

## Real-life example: the problem

موقع تجارة إلكترونية يتكون من غلاف رئيسي، وفريق "الكتالوج"، وفريق "إتمام الشراء Checkout". نشر فريق Checkout تحديثاً يوم الثلاثاء؛ ويوم الأربعاء توقف زر "Add to cart" في صفحة الكتالوج عن تحديث شارة عدد عناصر السلة، وواجه بعض المستخدمين شاشة بيضاء بانهيار "Invalid hook call". وعلاوة على ذلك، حوّل ملف التنسيق الجديد لـ Checkout لون جميع أزرار `.button` في الموقع بالكامل إلى اللون الأخضر!

```js
// checkout/webpack.config.js - BROKEN
new ModuleFederationPlugin({
  name: 'checkout',
  filename: 'remoteEntry.js',
  exposes: {
    './CartStore': './src/store/cartStore',   // exposes internal Redux store
    './CheckoutPage': './src/CheckoutPage',
  },
  // no "shared": checkout bundles its own React 19 copy
});

// shell/webpack.config.js - BROKEN
new ModuleFederationPlugin({
  name: 'shell',
  remotes: { checkout: 'checkout@https://cdn.example.com/checkout/remoteEntry.js' },
});
```

```tsx
// catalog/src/AddToCart.tsx - BROKEN: reaches into another team's internals
import { cartStore } from 'checkout/CartStore';
cartStore.dispatch({ type: 'cart/ADD', payload: product }); // action renamed on Tuesday
```

```css
/* checkout/src/styles.css - BROKEN: global selectors leak into every app */
.button { background: green; }
```

ما حدث: نسختان من React (انهيار خطافات الـ hooks عبر الحدود)، وارتباط خفي ومباشر بأسماء Redux actions الخاصة بفريق آخر (تمت إعادة تسميتها دون إخطار)، ورابط `remoteEntry.js` غير محدد الإصدار يسحب المضيف منه "أحدث ما رُفع" بشكل عشوائي، وتسرب لتنسيقات الـ CSS العامة.

## How to fix it

```js
// shared config used by every app (packages/mf-shared.js)
const deps = require('./package.json').dependencies;
module.exports.shared = {
  react: { singleton: true, requiredVersion: deps.react },
  'react-dom': { singleton: true, requiredVersion: deps['react-dom'] },
  '@acme/design-system': { singleton: true, requiredVersion: deps['@acme/design-system'] },
};

// checkout/webpack.config.js
new ModuleFederationPlugin({
  name: 'checkout',
  filename: 'remoteEntry.js',
  exposes: { './mount': './src/mount' },   // ONE public entry point
  shared: require('@acme/mf-shared').shared,
});
```

```ts
// @acme/contracts (versioned npm package, owned jointly)
export type CartItemAdded = { sku: string; qty: number };
export const CART_ITEM_ADDED = 'cart:item-added/v1';

export function emitCartItemAdded(detail: CartItemAdded) {
  window.dispatchEvent(new CustomEvent(CART_ITEM_ADDED, { detail }));
}
```

```tsx
// catalog/src/AddToCart.tsx - talks through the contract only
import { emitCartItemAdded } from '@acme/contracts';
<button className={styles.addButton} onClick={() => emitCartItemAdded({ sku, qty: 1 })}>
  Add to cart
</button>
```

```ts
// shell: remotes resolved from a manifest the deploy pipeline updates
const manifest = await fetch('/mf-manifest.json').then((r) => r.json());
// { "checkout": "https://cdn.example.com/checkout/1.42.0/remoteEntry.js" }
const { mount } = await loadRemote('checkout/mount');   // @module-federation/runtime
```

لماذا ينجح هذا الحل:
- نسخة React وحيدة مشتركة تضمن عمل الخطافات والسياق عبر التطبيقات البعيدة؛ مع تحذير وقت التشغيل عبر `requiredVersion` في حال عدم توافق الإصدارات.
- يُتيح كل تطبيق بعيد نقطة دخول عامة واحدة `mount` (أو مكوناً مفرداً) بـ props محددة الأنواع؛ مما يمنح الفريق حرية تعديل كودهم الداخلي. العقد ذو إصدار صريح (`/v1`)، والتعديلات الجذرية تُنشر كـ `v2` بجانب `v1` لفترة انتقالية.
- بيان نشر (manifest) بروابط ذات إصدارات غير قابلة للتعديل يتيح النشر المستقل **والتراجع الفوري** (بإعادة توجيه البيان إلى الإصدار `1.41.0`).
- تُنتج CSS Modules أسماء فئات معزولة النطاق؛ وتقتصر التنسيقات العامة على الغلاف المضيف ونظام التصميم.
- يُغلف كل تطبيق بعيد بـ Error Boundary وحدود `Suspense` داخل الغلاف، بحيث يؤدي انهيار تطبيق بعيد إلى تعطل منطقته الخاصة فقط دون إسقاط الصفحة بأكملها.

البدائل: التجميع من جانب الخادم (Edge-side includes، أو Next.js Multi-Zones لكل مسار)، أو استخدام iframes للعزل التام (ودجات الأطراف الخارجية)، أو الاكتفاء بمستودع موحد Monorepo بحزم مستقلة (مثل Nx أو Turborepo).

## How to say it in the interview

- "تحل معمارية Micro-frontends مشكلة تنظيمية في المقام الأول: فرق عمل متعددة ومستقلة تتطلب دورات نشر وإطلاق مستقلة. وإذا لم تكن تواجه هذه المعضلة التنظيمية، فإن الـ Monorepo المعياري أقل تكلفة وأسهل إدارة."
- "القواعد الذهبية: نسخ مفردة مشتركة لـ React ونظام التصميم، ونقطة دخول عامة واحدة لكل تطبيق، وعقود محددة الإصدار عبر الأحداث والـ props والـ URL، وتنسيقات CSS معزولة النطاق، وحدود حماية Error Boundary حول كل تطبيق بعيد."
- فخ المقابلة: "كيف تختبر هذا النظام؟" - اختبارات العقود (Contract tests) على الأنواع المشتركة، بالإضافة لاختبارات فحص دخاني شاملة (E2E smoke tests) داخل الغلاف المضيف مقابل الإصدارات المنشورة قبل تحديث ملف الـ manifest.
- المفاضلة (Trade-off): تؤدي زيادة الحزم والتبعيات المكررة إلى الإضرار بالأداء؛ لذا يجب فرض قائمة تبعيات مشتركة وميزانية حجم لحزمة كل تطبيق بعيد.
