# كيف تكتب اختبارات وحدة (Unit Tests) جيدة باستخدام Jest و React Testing Library؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- كيف تكتب اختبارات الوحدة في React باستخدام Jest و React Testing Library؟

## The concept (short answer)
- أداة **Jest** (أو Vitest المشابهة لها تماماً) هي **مشغل الاختبارات ومكتبة التوكيدات (Test runner & assertion library)**: تبحث عن ملفات `*.test.js`، وتشغلها في بيئة محاكاة للمتصفح (`jsdom`)، وتوفر دوال `describe` و `test` و `expect` والدوال الوهمية (`jest.fn()` و `jest.mock()`) والمؤقتات الزائفة.
- مكتبة **React Testing Library (RTL)** تصيّر المكونات داخل تلك البيئة وتتيح لك البحث عن العناصر والتفاعل معها **بنفس الطريقة التي يتبعها المستخدم الحقيقي**. مبدؤها الإرشادي الذهبي: "كلما اقتربت اختباراتك من الطريقة التي يُستخدم بها برنامجك، كلما منحتك ثقة أكبر."
- لذلك نحن نختبر **السلوك الظاهر، وليس تفاصيل التنفيذ الداخلية**: نبحث عن العناصر بالـ role والـ label والنص (`getByRole("button", { name: /save/i })`)، ونتفاعل عبر `@testing-library/user-event`، ونتأكد مما يراه المستخدم أمامه. وتجنب اختبار الـ state الداخلية أو استدعاءات الـ hooks أو فئات الـ CSS.
- أنواع الاستعلامات:
  - `getBy*`: تفترض وجود العنصر فوراً وترمي خطأ إن لم تجده.
  - `queryBy*`: ترجع `null` إن لم تجده، وتُستخدم لإثبات عدم ظهور عنصر ما.
  - `findBy*`: دالة غير متزامنة تنتظر ظهور العنصر بعد استرجاع البيانات أو تحديث الحالة.
- اتبع نمط **الترتيب والتنفيذ والتوكيد (Arrange - Act - Assert)**؛ وحاكي طلبات الشبكة عند الحدود فقط (`jest.fn` لدالة `fetch`، أو استخدام MSW لمحاكاة واقعية).
- تضيف حزمة `@testing-library/jest-dom` توكيدات واضحة ومقروءة مثل `toBeInTheDocument()` و `toBeDisabled()` و `toHaveValue()`.

## Real-life example: the problem
حالة شائعة: يمتلك فريق نسبة تغطية اختبارات 90% لنموذج اشتراك في نشرة بريدية، ومع ذلك تم إطلاق نسخة للإنتاج ظل فيها زر الإرسال معطلاً للأبد بعد فشل الطلب، وعجز المستخدمون عن إعادة المحاولة. وكانت جميع الاختبارات تنجح بلونها الأخضر لأنها كانت تختبر تفاصيل التنفيذ: تستدعي دوال داخلية، وتتفحص متغيرات الـ state، وتنكسر مع كل إعادة هيكلة برمجية (مما جعل المطورين يحدثون لقطات الـ snapshots دون قراءتها).

```jsx
// SignupForm.test.jsx: هش، يختبر تفاصيل التنفيذ، ويغفل الخطأ الحقيقي تماماً
import { render, fireEvent } from "@testing-library/react";
import SignupForm from "./SignupForm";

test("signup form", () => {
  const { container } = render(<SignupForm />);
  const input = container.querySelector(".signup__input");   // مرتبط بفئة CSS
  fireEvent.change(input, { target: { value: "a@b.com" } });
  fireEvent.click(container.querySelector("button"));
  expect(container).toMatchSnapshot();                       // لقطة ضخمة لا يراجعها أحد
  // لا يوجد await: طلب الشبكة لا يستقر أبداً داخل الاختبار
  // مسار الأخطاء لم يُختبر مطلقاً
});
```

المكون الذي يحتوي على الخطأ البرمجي الذي أغفلته الاختبارات السابقة:

```jsx
// SignupForm.jsx
export default function SignupForm({ subscribe }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success
  const [showError, setShowError] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setShowError(false);
    setStatus("loading");
    try {
      await subscribe(email);
      setStatus("success");
    } catch {
      setShowError(true);          // خطأ: تظل الحالة "loading" -> يتعطل الزر للأبد!
    }
  }

  if (status === "success") return <p>Thanks! Check your inbox.</p>;
  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit" disabled={status === "loading"}>Subscribe</button>
      {showError && <p role="alert">Something went wrong. Please try again.</p>}
    </form>
  );
}
```

## How to fix it
أولاً، اكتب اختبارات سلوك تغطي كافة المسارات (النجاح، الخطأ مع إعادة المحاولة، والتحميل). يفشل اختبار الخطأ أدناه مع المكون المعطوب أعلاه بدقة، وهو ما نريده تماماً. ثم نصلح المكون باعتماد حالة حالة موحدة:

```jsx
// داخل SignupForm: أصبحت القيم "idle" | "loading" | "success" | "error"
} catch {
  setStatus("error");              // يغادر حالة "loading"، فيعود الزر للتفعيل مجدداً
}
// ...
{status === "error" && <p role="alert">Something went wrong. Please try again.</p>}
```

تختبر الملفات عبر حقن دالة الـ API كـ prop والتحقق مما يراه المستخدم:

```jsx
// SignupForm.test.jsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import SignupForm from "./SignupForm";

function setup(subscribe = jest.fn().mockResolvedValue({})) {
  const user = userEvent.setup();
  render(<SignupForm subscribe={subscribe} />);
  return { user, subscribe };
}

describe("SignupForm", () => {
  test("subscribes the user and shows a confirmation", async () => {
    const { user, subscribe } = setup();

    await user.type(screen.getByLabelText(/email/i), "ana@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    expect(subscribe).toHaveBeenCalledWith("ana@example.com");
    expect(await screen.findByText(/thanks! check your inbox/i)).toBeInTheDocument();
  });

  test("shows an error and lets the user retry when the request fails", async () => {
    const subscribe = jest.fn()
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValueOnce({});
    const { user } = setup(subscribe);

    await user.type(screen.getByLabelText(/email/i), "ana@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/try again/i);
    const button = screen.getByRole("button", { name: /subscribe/i });
    expect(button).toBeEnabled();                     // كان سيكتشف الخطأ البرمجي فوراً!

    await user.click(button);
    expect(await screen.findByText(/thanks/i)).toBeInTheDocument();
    expect(subscribe).toHaveBeenCalledTimes(2);
  });

  test("disables the button while the request is pending", async () => {
    const { user } = setup(jest.fn(() => new Promise(() => {}))); // طلب معلق لا يستقر
    await user.type(screen.getByLabelText(/email/i), "ana@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));
    expect(screen.getByRole("button", { name: /subscribe/i })).toBeDisabled();
  });
});
```

لماذا ينجح هذا الحل:
- استعلامات الـ role والـ label هي ما يتفاعل معه المستخدم وقارئات الشاشة، فتصمد الاختبارات عند تغيير فئات الـ CSS أو استبدال الـ state بـ reducer، وتفشل فقط عندما يتعطل السلوك الفعلي.
- تحاكي `userEvent` التفاعلات الواقعية (التركيز والضغط على المفاتيح والأحداث)، على عكس `fireEvent` السطحية.
- تنتظر `findBy*` التحديثات غير المتزامنة، فتختفي تحذيرات "act" ولا تنجح الاختبارات قبل أوانها.
- كل مسار سلوكي مفصول في اختبار مستقل وواضح.

بدائل أخرى: بدلاً من تمرير `subscribe` كـ prop، يمكن استخدام `jest.mock("./api")` أو استخدام MSW لاعتراض طلبات الشبكة؛ كما أن Vitest بديل فوري مطابق في مشاريع Vite.

## How to say it in the interview
- "Jest هي مشغل الاختبارات ومكتبة التوكيدات؛ ومكتبة React Testing Library تصيّر المكونات وتتيح لي التفاعل معها تماماً كالمستخدم الحقيقي. أستعلم بالـ role أو التسمية، وأتفاعل بـ user-event، وأؤكد على العناصر المرئية."
- وضّح الفروق بين `getBy` و `queryBy` و `findBy` ومتى تستخدم كلاً منها، فهذا سؤال متابعة شبه دائم.
- فخ المقابلة: اختبار تفاصيل التنفيذ (الـ state الداخلية، أسماء فئات CSS، ولقطات snapshots الضخمة). نسبة التغطية لا تعني الجودة؛ واختبر دائماً مسارات الأخطاء والحالات الحدية (edge cases).
- المفاضلة: اختبارات الوحدة مع المحاكاة سريعة جداً لكنها قد تغفل أخطاء تكامل الأنظمة معاً؛ لذا أكملها باختبارات E2E قليلة ومحكمة (Cypress/Playwright) للمسارات الحرجة في التطبيق.
