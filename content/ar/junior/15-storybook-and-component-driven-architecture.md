# ما هو Storybook وما هي المعمارية الموجهة بالمكونات (Component-Driven Architecture)؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- ما هو Storybook؟ ولماذا يُستخدم في تطوير الواجهات الأمامية؟
- اشرح مفهوم المعمارية الموجهة بالمكونات (Component-Driven Architecture).‏

## The concept (short answer)
- **المعمارية الموجهة بالمكونات (Component-driven development / CDD)** تعني بناء واجهة المستخدم بأسلوب "من القاعدة إلى القمة (bottom-up)" بدءاً من المكونات الصغيرة المعزولة والقابلة لإعادة الاستخدام (Button، Input، ProductCard) وتركيبها في أجزاء أكبر (CheckoutForm) وصولاً إلى الصفحات الكاملة. وهي نفس فكرة التصميم الذري (Atomic Design): ذرات -> جزيئات -> كائنات -> قوالب -> صفحات.
- المكونات الجيدة هي **مكونات عرض غير مقيدة بالبيانات (presentational and data-agnostic)**: تستقبل البيانات ودوال رد النداء عبر الـ props، ولا تجلب بيانات من الـ API أو تقرأ الحالة العامة بنفسها. بينما تتولى مكونات الحاويات (containers) والصفحات إدارة البيانات.
- **Storybook** هي أداة بيئة عمل تعزل المكون وتصيّره خارج تطبيقك الرئيسي، في كافة حالاته الممكنة ("stories"): الافتراضية، التحميل، الخطأ، التعطيل، النصوص الطويلة، الحالة الفارغة، والوضع الداكن.
- لماذا تستخدمها الفرق: تطوير واجهات المستخدم دون الحاجة لجلب بيانات حقيقية من الخادم أو الانتقال عميقاً داخل التطبيق؛ توفير توثيق حي وكتالوج لنظام التصميم (design system) للمصممين والمطورين؛ وإجراء اختبارات الانحدار البصري (visual regression testing عبر Chromatic)، واختبارات التفاعل (`play` functions)، وفحوصات إمكانية الوصول لكل قصة.
- تُكتب القصص بصيغة **CSF** (صيغة قصص المكونات Component Story Format): تصدير افتراضي يحتوي البيانات الوصفية، وتصديرات مسماة تمثل كل منها قصة مع `args` (الـ props).‏

## Real-life example: the problem
حالة شائعة: لدى فريق تجارة إلكترونية مكون `ProductCard` يجلب بياناته بنفسه ويقرأ سلة التسوق من السياق العام (Context). وحالات مثل "نفاد الكمية" أو "عرض خاص" لا يمكن معاينتها إلا بالعثور على منتج حقيقي يطابق تلك الحالة في بيئة الاختبار. قام مطور بتغيير حجم خط السعر، ولم يلاحظ أحد أن شارة التخفيضات أصبحت تتداخل وتغطي أسماء المنتجات الطويلة، فشاهد العملاء بطاقات مشوهة في صفحة التصنيف الحية. كما تم نسخ نفس البطاقة إلى صفحة قائمة الرغبات بتنسيقات مختلفة قليلاً، فأصبح إصلاح أي خلل يتطلب تعديل ملفين.

```jsx
// ProductCard.jsx: مترابط بشدة، ويستحيل تصييره بمعزل عن التطبيق
export function ProductCard({ productId }) {
  const [product, setProduct] = useState(null);
  const { addToCart } = useCart();            // يتطلب وجود CartProvider بالكامل

  useEffect(() => {
    fetch(`/api/products/${productId}`)       // يتطلب تشغيل خادم API حقيقي
      .then((r) => r.json())
      .then(setProduct);
  }, [productId]);

  if (!product) return null;                  // لا توجد حالة تحميل (skeleton)
  return (
    <div className="card">
      <img src={product.image} />
      <h3>{product.name}</h3>
      {product.salePrice && <span className="badge">SALE</span>}
      <p>{product.salePrice ?? product.price} EUR</p>
      <button onClick={() => addToCart(product.id)}>Add</button>
    </div>
  );
}
```

## How to fix it
افصل البيانات عن العرض التقديمي، ثم وثّق كل حالة في Storybook.‏

```jsx
// ProductCard.jsx: نقي تماماً، props في المدخلات وأحداث في المخرجات
export function ProductCard({ product, onAddToCart, isLoading = false }) {
  if (isLoading) return <div className="card card--skeleton" aria-busy="true" />;

  const { name, image, price, salePrice, inStock } = product;
  return (
    <article className="card">
      <img src={image} alt={name} />
      <h3 className="card__title">{name}</h3>
      {salePrice != null && <span className="badge">Sale</span>}
      <p>{(salePrice ?? price).toFixed(2)} EUR</p>
      <button disabled={!inStock} onClick={() => onAddToCart(product.id)}>
        {inStock ? "Add to cart" : "Out of stock"}
      </button>
    </article>
  );
}

// ProductCardContainer.jsx: طبقة البيانات تعيش هنا
export function ProductCardContainer({ productId }) {
  const { data, isLoading } = useProduct(productId); // مثلاً عبر TanStack Query
  const { addToCart } = useCart();
  return <ProductCard product={data} isLoading={isLoading} onAddToCart={addToCart} />;
}
```

```jsx
// ProductCard.stories.jsx (CSF 3)
import { fn, expect, userEvent, within } from "@storybook/test";
import { ProductCard } from "./ProductCard";

const base = {
  id: "p1", name: "Wireless Headphones", image: "/headphones.jpg",
  price: 89.99, salePrice: null, inStock: true,
};

export default {
  title: "Shop/ProductCard",
  component: ProductCard,
  args: { product: base, onAddToCart: fn() },
  tags: ["autodocs"],
};

export const Default = {};
export const OnSale = { args: { product: { ...base, salePrice: 59.99 } } };
export const OutOfStock = { args: { product: { ...base, inStock: false } } };
export const LongName = {
  args: { product: { ...base, salePrice: 59.99,
    name: "Noise-Cancelling Over-Ear Wireless Headphones with 40h Battery" } },
};
export const Loading = { args: { isLoading: true } };

export const AddsToCart = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /add to cart/i }));
    await expect(args.onAddToCart).toHaveBeenCalledWith("p1");
  },
};
```

لماذا ينجح هذا الحل:
- أصبح `ProductCard` الآن قابلاً لإعادة الاستخدام في صفحات التصنيف والرغبات والبحث؛ والفرق الوحيد يكمن في الحاوية (container).‏
- كل حالة حافة (خصم + اسم طويل، نفاد الكمية، التحميل) متاحة بنقرة واحدة في Storybook، فيظهر خطأ تداخل النصوص أثناء التطوير وتكتشفه اختبارات الـ CI قبل الدمج.
- دالة `play` تمثل اختبار تفاعل حقيقي يعمل داخل المتصفح؛ وتقوم `fn()` بتسجيل دوال رد النداء.
- صفحة التوثيق التلقائي في Storybook تصبح الكتالوج الموحد الذي يرجع إليه المصممون والمطورون.

أدوات بديلة: توفر Ladle أو Histoire بدائل أخف وزناً؛ وإذا كنت بحاجة لبيانات API في القصص، استخدم محاكاة عبر MSW (Mock Service Worker) بدلاً من ربط المكون بالشبكة مباشرة.

## How to say it in the interview
- "التطوير الموجه بالمكونات يعني بناء الواجهات من المكونات الصغيرة المعزولة صعوداً إلى الصفحات الكاملة. و Storybook هي البيئة التي أبني وأوثق فيها تلك المكونات بجميع حالاتها دون تشغيل التطبيق بالكامل."
- اذكر الفصل بين المكونات التقديمية (props للمدخلات ودوال للأحداث) ومكونات الحاويات التي تدير البيانات، لأن ذلك هو ما يجعل عزل المكونات واختبارها أمراً ممكناً.
- سؤال المتابعة: "كيف يساعد Storybook في الاختبار؟" اختبارات الانحدار البصري (Chromatic)، اختبارات التفاعل بدوال `play`، إضافات إمكانية الوصول a11y، وإعادة استخدام القصص في Jest/Vitest عبر `composeStories`.‏
- المفاضلة: تحتاج القصص إلى صيانة مستمرة ويضيف Storybook إعدادات بناء للمشروع؛ وهو ذو عائد استثماري ضخم في أنظمة التصميم المشتركة والفرق الكبيرة، بينما قد يكون زائداً عن الحاجة للتطبيقات الفردية البسيطة.
