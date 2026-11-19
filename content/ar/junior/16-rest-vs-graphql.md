# ما الفرق بين REST APIs و GraphQL؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- اشرح الفرق بين REST APIs و GraphQL.‏

## The concept (short answer)
- تعتمد معمارية **REST** على **عناوين موارد متعددة (Resource URLs)** مثل (`/users/42` و `/users/42/orders`) وتستخدم أفعال بروتوكول HTTP المعتادة (GET و POST و PUT/PATCH و DELETE) ورموز الحالة. ويحدد **الخادم شكل وحجم الاستجابة** لكل نقطة نهاية.
- توفر **GraphQL** **نقطة نهاية وحيدة (Single endpoint)** (عادةً `POST /graphql`) مع **مخطط بيانات محدد الأنواع (typed schema)**. يرسل **العميل استعلاماً يصف بدقة الحقول التي يحتاجها فقط**، وربما عبر عدة أنواع بيانات مترابطة، ويحصل على استجابة تطابق نفس الشكل المطلوب تماماً.
- المشاكل التي تحلها GraphQL في REST: **جلب البيانات الزائدة (Over-fetching)** (استلام 40 حقلاً بينما تحتاج 3 حقول فقط) و**نقص جلب البيانات وتعدد الطلبات (Under-fetching / Waterfall)** (جلب المستخدم أولاً، ثم طلب طلباته، ثم طلب تفاصيل كل منتج على حدة).‏
- نقاط قوة REST: البساطة، التخزين المؤقت المجاني على مستوى HTTP (عبر الـ CDN والمتصفحات و ETag) لأن لكل طلب GET عنوان URL فريد خاص به، سهولة التأمين وتحديد معدل الطلبات (rate-limiting) لكل نقطة، ووفرة الأدوات القياسية.
- تكاليف وتحديات GraphQL: يحتاج التخزين المؤقت إلى مكتبة عميل مخصصة (مثل Apollo أو urql أو Relay) مع كاش مهيكل؛ تعود الأخطاء غالباً مع كود HTTP 200 ومصفوفة `errors`؛ والاستعلامات العميقة المتداخلة قد ترهق قاعدة البيانات في الخادم (مشكلة N+1 query التي تتطلب أدوات مثل DataLoader وحدوداً لعمق الاستعلامات).‏
- لا يوجد أسلوب "أفضل" بإطلاق: يناسب REST عمليات الـ CRUD البسيطة والـ APIs العامة؛ بينما يناسب GraphQL البيانات المعقدة المترابطة المستهلكة من قِبل عملاء متعددين (ويب وهواتف) باحتياجات مختلفة.

## Real-life example: the problem
حالة شائعة: استغرقت شاشة "طلباتي" في تطبيق متجر للهواتف من 4 إلى 5 ثوانٍ للتحميل على شبكات 3G. أرسل التطبيق طلباً لجلب بيانات المستخدم، ثم طلباً لجلب قائمة الطلبات، ثم طلباً **لكل طلب في القائمة** لجلب أسماء المنتجات وصورها المصغرة (شلال طلبات متتالية N+1 في جانب العميل). وكانت كل استجابة منتج بحجم 30 كيلوبايت من كود JSON (الوصف الكامل، المواصفات الفنية، والمراجعات) رغم أن الشاشة لا تعرض سوى اسم المنتج وصورته المصغرة.

```js
// REST بأسلوب بدائي ساذج: 2 + N طلبات متتالية، معظم بياناتها غير مستخدمة
async function loadOrdersScreen(userId) {
  const user = await fetch(`/api/users/${userId}`).then((r) => r.json());
  const orders = await fetch(`/api/users/${userId}/orders`).then((r) => r.json());

  for (const order of orders) {
    // متتالية: 20 طلباً = 20 رحلة شبكة ذهاباً وإياباً
    const product = await fetch(`/api/products/${order.productId}`).then((r) => r.json());
    order.productName = product.name;          // تم تحميل 30 كيلوبايت، واستُخدم حقلان فقط!
    order.thumbnail = product.images[0].url;
  }
  return { userName: user.firstName, orders };
}
```

## How to fix it
الخيار (أ): استخدام GraphQL برحلة شبكة واحدة وجلب الحقول المطلوبة فقط بدقة.

```js
const ORDERS_SCREEN = /* GraphQL */ `
  query OrdersScreen($userId: ID!) {
    user(id: $userId) {
      firstName
      orders(last: 20) {
        id
        status
        total
        product { name thumbnailUrl }
      }
    }
  }
`;

async function loadOrdersScreen(userId) {
  const res = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: ORDERS_SCREEN, variables: { userId } }),
  });
  const { data, errors } = await res.json();
  if (errors?.length) throw new Error(errors[0].message); // كود HTTP يظل 200 رغم وجود خطأ!
  return data.user;
}
```

في جانب الخادم، يقوم كل resolver بتحميل حقله؛ ويستخدم `product` أداة DataLoader لدمج استعلامات قاعدة البيانات العشرين في استعلام مجمّع واحد.

الخيار (ب): البقاء مع REST مع تحسين تصميم نقاط النهاية للشاشة.

```js
// 1) تشغيل الطلبات بالتوازي بدلاً من الـ await المتتالي
const [user, orders] = await Promise.all([
  fetch(`/api/users/${userId}`).then((r) => r.json()),
  fetch(`/api/users/${userId}/orders?expand=product&fields=id,status,total,product.name,product.thumbnailUrl`)
    .then((r) => r.json()),
]);
// 2) أو إنشاء نقطة نهاية مخصصة للشاشة (BFF): GET /api/screens/orders
```

لماذا ينجح هذا الحل:
- تتيح GraphQL للعميل طلب البيانات المترابطة المتداخلة في طلب واحد، فينخفض التأخير من 2 + N رحلة شبكة إلى رحلة واحدة فقط، ويتقلص حجم البيانات المنقولة من مئات الكيلوبايتات إلى كيلوبايتات قليلة.
- يحل تحسين REST المشكلة عبر `Promise.all`، أو دعم معلمات التوسيع وتحديد الحقول في الخادم، أو نمط BFF مع الحفاظ على كاش الـ HTTP.‏

جدول المقارنة السريعة:

| وجه المقارنة | REST | GraphQL |
|---|---|---|
| نقاط النهاية | متعددة، نقطة لكل مورد | نقطة واحدة موحدة |
| شكل الاستجابة | يحدده الخادم مسبقاً | يختاره العميل بدقة |
| التخزين المؤقت (Caching) | مدعوم تلقائياً عبر HTTP/CDN | كاش في جانب العميل (Apollo/urql)، استعلامات محفوظة للـ CDN |
| الأخطاء | عبر رموز حالة HTTP المعتادة | عادةً كود 200 مع مصفوفة `errors` |
| كتابة الأنواع | عبر مواصفات خارجية مثل OpenAPI | مخطط بيانات أصلي مدمج، مع توليد أنواع TypeScript تلقائياً |
| إدارة الإصدارات | عبر الروابط `/v1`, `/v2` | تطوير نفس المخطط، مع وسم الحقول القديمة بـ `@deprecated` |

## How to say it in the interview
- "تعتمد REST على الموارد مع نقاط نهاية متعددة واستجابات يحددها الخادم؛ بينما توفر GraphQL نقطة نهاية واحدة بمخطط بيانات محدد الأنواع يطلب فيه العميل الحقول التي يحتاجها فقط، مما يلغي مشكلتي الـ over-fetching وتعدد رحلات الشبكة."
- كن متوازناً وموضوعياً: تتفوق REST في البساطة والتخزين المؤقت التلقائي عبر بروتوكول HTTP؛ بينما تتفوق GraphQL عندما تحتاج الشاشات إلى بيانات مترابطة من موارد مختلفة ولدعم عدة منصات (ويب وهواتف).‏
- فخ المقابلة: القول بأن "GraphQL أسرع دائماً". هذا ليس تلقائياً؛ فسوء إعداد الـ resolvers يسبب مشكلة N+1 في قاعدة البيانات، مما يتطلب استخدام DataLoader وحدوداً لتكلفة الاستعلامات.
- سؤال المتابعة: التعامل مع الأخطاء. يجب فحص مصفوفة `errors` وليس الاعتماد على `res.ok` فقط، لأن GraphQL تعود غالباً بكود 200 حتى عند وجود أخطاء جزئية.
