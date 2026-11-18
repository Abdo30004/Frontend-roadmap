# ما هي اختبارات النهاية إلى النهاية (E2E Testing) وكيف تعمل في Cypress؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- اشرح اختبارات النهاية إلى النهاية (End-to-End Testing) باستخدام Cypress أو Selenium.

## The concept (short answer)
- تقود **اختبارات النهاية إلى النهاية (E2E tests)** **متصفحاً حقيقياً** لاختبار **التطبيق أثناء تشغيله الفعلي** (الواجهة الأمامية + الخلفية أو محاكاة واقعية) ومحاكاة رحلات المستخدم الكاملة: تسجيل الدخول، والبحث، والإضافة إلى السلة، والدفع. وتتأكد من أن جميع الأجزاء تعمل معاً بتناغم، وهو ما لا تستطيع اختبارات الوحدة مع المحاكاة إثباته.
- في هرم الاختبارات، تقبع هذه الاختبارات في القمة: **عدد قليل، وبطيئة، وذات موثوقية عالية جداً** للمسارات الحساسة. فالقاعدة هي: الكثير من اختبارات الوحدة، وبعض اختبارات التكامل، وقبضة محكمة من اختبارات الـ E2E.
- **Selenium** (WebDriver): المعيار الأقدم، يقود المتصفحات عبر بروتوكول مشغلات خارجي ويدعم العديد من اللغات (Java و Python و C# و JS). وهو قوي لكنه معقد الإعداد وتكثر فيه الاختبارات غير المستقرة (flaky tests) إذا استُخدم الانتظار اليدوي.
- **Cypress**: بيئة مخصصة لجافاسكريبت، تعمل داخل المتصفح جنباً إلى جنب مع تطبيقك، وتتميز بـ **الانتظار وإعادة المحاولة التلقائية (auto-waiting / retrying)** للتوكيدات، واستكشاف الأخطاء عبر الزمن (time-travel debugging)، والتقاط الصور والفيديوهات، ودالة `()cy.intercept` لمراقبة طلبات الشبكة ومحاكاتها.
- **Playwright** (من Microsoft): البديل الحديث الذي تختاره العديد من الفرق اليوم. يدعم محركات Chromium و Firefox و WebKit (Safari)، وفتح عدة تبويبات ومصادر، وتشغيل متوازٍ افتراضياً، ومحددات تنتظر تلقائياً (`getByRole`)، وسرعة فائقة في بيئات الـ CI.
- أفضل الممارسات: اختيار العناصر بالـ role والـ label أو `data-testid` وتجنب سلاسل CSS الهشة؛ عدم استخدام فترات انتظار ثابتة (`wait(3000)`)؛ زرع بيانات الاختبار عبر الـ API بدلاً من واجهة المستخدم؛ وجعل كل اختبار مستقلاً بذاته.

## Real-life example: the problem
حالة شائعة: يمتلك موقع لحجز السفر حزمة اختبارات E2E تفشل عشوائياً في تشغيل واحد من كل 5 تشغيلات، مما جعل الفريق يتجاهل البناء الأحمر في الـ CI. وفي أحد الأسابيع تسلل خطأ فادح للإنتاج: فبعد تغيير في التصميم، غطت نافذة ملفات تعريف الارتباط (cookie banner) زر "Pay" على الشاشات الصغيرة، فعجز العملاء عن إتمام الحجوزات على الهواتف لنصف يوم. وكان الاختبار الذي يفترض به اكتشاف ذلك قد تم تخطيه (skip) بدعوى أنه "غير مستقر بطبيعته".

```js
// cypress/e2e/booking.cy.js: هش وغير مستقر
describe("booking", () => {
  it("books a hotel", () => {
    cy.visit("/");
    cy.get("#root > div > div:nth-child(2) > form > input").type("Lisbon"); // محدد CSS هش للغاية
    cy.get(".btn-primary").click();
    cy.wait(5000);                                       // أمل في انتهاء الـ API خلال 5 ثوانٍ!
    cy.get(".result-card").first().click();
    cy.get(".btn-primary").eq(1).click({ force: true }); // force يخفي خطأ حجب الزر بنافذة الكوكيز!
    cy.wait(3000);
    cy.contains("Confirmed");
  });
  // يعتمد على قاعدة بيانات مشتركة في بيئة التجريب؛ فيفشل إذا حجز شخص آخر الغرفة الأخيرة
});
```

## How to fix it
```js
// cypress/e2e/booking.cy.js
describe("Hotel booking", () => {
  beforeEach(() => {
    cy.viewport("iphone-x");                                  // اختبار تخطيط الهواتف أيضاً
    cy.request("POST", "/api/test/seed", { scenario: "lisbon-available" }); // بيانات مخصصة ومعزولة
    cy.intercept("GET", "/api/hotels*").as("searchHotels");
    cy.intercept("POST", "/api/bookings").as("createBooking");
  });

  it("lets a guest search, book and see a confirmation", () => {
    cy.visit("/");
    cy.findByRole("button", { name: /accept cookies/i }).click(); // كالمستخدم الحقيقي تماماً

    cy.findByLabelText(/destination/i).type("Lisbon");
    cy.findByRole("button", { name: /search/i }).click();
    cy.wait("@searchHotels").its("response.statusCode").should("eq", 200);

    cy.findAllByTestId("hotel-card").first().click();
    cy.findByRole("button", { name: /pay/i }).should("be.visible").click(); // بدون force

    cy.wait("@createBooking");
    cy.findByRole("heading", { name: /booking confirmed/i }).should("be.visible");
  });
});
```

نفس الاختبار باستخدام أداة Playwright الحديثة:

```ts
// tests/booking.spec.ts
import { test, expect, devices } from "@playwright/test";

test.use({ ...devices["iPhone 13"] });

test("guest can book a hotel", async ({ page, request }) => {
  await request.post("/api/test/seed", { data: { scenario: "lisbon-available" } });

  await page.goto("/");
  await page.getByRole("button", { name: /accept cookies/i }).click();
  await page.getByLabel(/destination/i).fill("Lisbon");
  await page.getByRole("button", { name: /search/i }).click();

  await page.getByTestId("hotel-card").first().click();
  await page.getByRole("button", { name: /pay/i }).click(); // سيفشل إذا كان مغطى بعنصر آخر!
  await expect(page.getByRole("heading", { name: /booking confirmed/i })).toBeVisible();
});
```

لماذا ينجح هذا الحل:
- انتظار استجابات الشبكة الصريحة (`@searchHotels`) أو استخدام محددات الانتظار التلقائي يلغي فترات النوم التخمينية، مما يزيل عدم الاستقرار ويسرع الاختبارات.
- تصمد محددات الـ role والـ label عند تغيير بنية الـ HTML أو فئات الـ CSS.
- إزالة خيار `{ force: true }` يجعل الاختبار يفشل كما يفشل المستخدم الحقيقي تماماً عندما يُحجب الزر، فيتم اكتشاف خطأ شريط الكوكيز.
- زرع البيانات عبر طلب API مستقل يجعل كل اختبار منعزلاً وقابلاً للتكرار دون تعارض.

أدوات بديلة: ما زال Selenium WebDriver (أو WebdriverIO) خياراً مستخدماً عند الحاجة للغات متعددة أو بنية تحتية سابقة؛ مع تطبيق نفس المبادئ تماماً (الانتظار الصريح، المحددات المستقرة، وعزل البيانات).

## How to say it in the interview
- "تقود اختبارات E2E متصفحاً حقيقياً في بيئة تطبيق قيد التشغيل وتغطي رحلات المستخدم الأساسية كالتسجيل والدفع. وأحافظ على تركيزها في عدد محدود للمسارات الحساسة لأنها أبطأ وأعلى تكلفة من اختبارات الوحدة."
- قارن الأدوات باقتضاب: Selenium ناضج ويدعم لغات متعددة؛ Cypress يوفر تجربة تطوير مريحة وإعادة محاولة تلقائية؛ و Playwright يتفوق في دعم محركات التصفح المتعددة (بما فيها WebKit) والتشغيل المتوازي السريع وهو ما يجعله خياراً مفضلاً للكثير من الفرق اليوم.
- فخ المقابلة: أسباب عدم استقرار الاختبارات (Flaky tests): فترات الانتظار الثابتة، المحددات الهشة، البيانات المشتركة بين الاختبارات، واعتماد الترتيب. وتُعالج بالانتظار التلقائي، ومحددات الـ role/test-id، والبيانات المعزولة.
- المفاضلة: محاكاة الـ API بالكامل بـ `cy.intercept` تجعل الاختبارات سريعة لكنها تفقد جزءاً من شمولية الـ E2E الحقيقية؛ لذا حافظ دائماً على اختبار واحد على الأقل مع واجهة خلفية حقيقية (Smoke test).
