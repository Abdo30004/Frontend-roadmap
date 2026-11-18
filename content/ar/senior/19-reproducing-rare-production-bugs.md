# إعادة إنتاج خطأ تصيير نادر يصيب 1% فقط من المستخدمين في الإنتاج

**Level:** Senior
**Merged from (original phrasings):**
- خطأ تصيير يؤثر على 1% فقط من المستخدمين. كيف تُعيد إنتاجه وتصلحه؟

## The concept (short answer)

- "1% من المستخدمين" تعني حتماً أن هناك **سمة مميزة ومختلفة في تلك الشريحة**. مهمتك الهندسية هي العثور على البُعد الذي يفصلهم عن البقية، وليس النقر العشوائي الأعمى على جهاز اللابتوب الخاص بك.
- **قسّم وشرّح الجلسات المتأثرة (Segment)** في أداة تتبع الأخطاء/RUM بحسب: المتصفح + الإصدار، ونظام التشغيل، ونوع الجهاز، واللغة/المنطقة الزمنية (Locale/Timezone)، ومقاس الشاشة (Viewport)، وأعلام الميزات/نسخ الـ A/B test، ورقم الإصدار، ونوع الحساب، وحالة الشبكة، ووجود إضافات المتصفح (عبر روابط الإضافات في أسطر الـ Stack frames). قارن ذلك بالشريحة السليمة: فالبُعد الذي يقفز فيه معدل الخطأ بشكل شاذ هو خيط دليلك الأول.
- استخدم **تسجيل الجلسات (Session Replay)** و**مسار التتبع (Breadcrumbs)** (النقرات، وتغيرات المسار، واستدعاءات الـ API، وسجلات console قبل الخطأ) لرؤية التسلسل الدقيق والبيانات التي كانت لدى المستخدم.
- **أعد إنتاج المشكلة على بيئة مطابقة تماماً**: أجهزة ومتصفحات حقيقية عبر BrowserStack أو Sauce Labs، واستخدم Playwright مع محركات WebKit و Firefox، وحاكي المنطقة واللغة (`--lang` و `TZ=`)، ونفس علم الميزة، ونفس بيانات المستخدم (نسخة معقمة خالية من البيانات الحساسة).
- إذا تعذر الإنتاج معملياً، **صغ فرضية وأضف سجلات تتبع موجهة (Targeted Logging)** (القيمة الخام للمدخلات، والمسار البرمجي المتخذ) في نشر تالٍ، ثم أثبت الفرضية أو انقضها بالأرقام. وبمجرد إعادة إنتاج الخطأ، اكتب اختباراً فاشلاً أولاً، ثم قم بالإصلاح.

## Real-life example: the problem

تطبيق لحجز مواعيد العيادات الطبية. يشتكي نحو 1% من المستخدمين من أن "التقويم يظهر فارغاً تماماً"، ويُسجل نظام تتبع الأخطاء استثناء `RangeError: Invalid time value` من قائمة المواعيد المتاحة. يعجز المطورون على متصفح Chrome ونظام macOS عن إنتاج المشكلة مهما حاولوا. كشفت تجزئة الخطأ في نظام التتبع أن 97% من الحالات تقع على **متصفح iOS Safari بإصداري 15 و 16** ومتصفح Safari 15 المكتبي؛ بينما تتوزع أعلام الميزات واللغات بشكل متساوٍ. وتكشف الـ Breadcrumbs أن الخطأ يقع فوراً بعد عودة طلب `GET /api/slots` برمز 200. ويُظهر تسجيل الجلسة ظهور هيكل التقويم يليه فوراً واجهة الخطأ البديلة (Error Fallback).

تُرجع الـ API طوابع زمنية بنمط قواعد البيانات، ويقوم العميل بتحليلها باستخدام منشئ `Date` الافتراضي:

```json
// GET /api/slots
[{ "id": 18, "start": "2026-03-29 14:00:00", "doctor": "Dr. Lee" }]
```

```tsx
// SlotList.tsx - BROKEN
import { format } from 'date-fns';

export function SlotList({ slots }: { slots: Slot[] }) {
  return (
    <ul>
      {slots.map((s) => (
        <li key={s.id}>
          {/* "YYYY-MM-DD HH:mm:ss" (space, no T) is NOT an ISO-8601 string.
              Chrome/Firefox are lenient and parse it as local time;
              older Safari versions return Invalid Date -> format() throws */}
          {format(new Date(s.start), 'EEE d MMM, HH:mm')} - {s.doctor}
        </li>
      ))}
    </ul>
  );
}
```

## How to fix it

**الخطوة 1: إعادة الإنتاج بشكل حتمي ومؤكد.** فتح الصفحة على جهاز iPhone حقيقي بإصدار Safari 15 عبر BrowserStack، وتأكيد ظهور التقويم الفارغ، ورصد المدخل الفاشل. ثم تثبيته داخل اختبار عابر للمتصفحات:

```ts
// slots.spec.ts - Playwright, run for chromium, firefox AND webkit projects
test('renders slots from API timestamps', async ({ page }) => {
  await page.route('**/api/slots', (r) =>
    r.fulfill({ json: [{ id: 18, start: '2026-03-29 14:00:00', doctor: 'Dr. Lee' }] }));
  await page.goto('/book');
  await expect(page.getByText('Sun 29 Mar, 14:00 - Dr. Lee')).toBeVisible();
});
```
```ts
// playwright.config.ts
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'webkit',   use: { ...devices['iPhone 13'], locale: 'en-GB', timezoneId: 'Europe/London' } },
],
```

**الخطوة 2: تصحيح العقد وتحليل التاريخ بدقة صريحة.**
```ts
// Server: return unambiguous ISO 8601 with an offset: "2026-03-29T14:00:00+01:00"

// Client: never use new Date(string) for non-ISO input; parse explicitly
import { parseISO, isValid, format } from 'date-fns';

export function parseSlotTime(raw: string): Date | null {
  const d = parseISO(raw);                      // date-fns' own parser: accepts "T" or space,
                                                // same result in every browser
  if (!isValid(d)) {
    Sentry.captureMessage('Unparseable slot time', { extra: { raw } });
    return null;
  }
  return d;
}

export function SlotList({ slots }: { slots: Slot[] }) {
  return (
    <ul>
      {slots.map((s) => {
        const start = parseSlotTime(s.start);
        return (
          <li key={s.id}>
            {start ? format(start, 'EEE d MMM, HH:mm') : 'Time unavailable'} - {s.doctor}
          </li>
        );
      })}
    </ul>
  );
}
```

لماذا ينجح هذا الحل: يحلل تابع `parseISO` التاريخ بشكل صريح بدلاً من الاعتماد على تساهل محركات المتصفحات مع الصيغ غير القياسية، فتحقق جميع المتصفحات نتيجة متطابقة؛ ويزيل إزاحة التوقيت أي غموض حول المنطقة الزمنية؛ وتؤدي أي قيمة تالفة الآن إلى خفض جودة سطر واحد بدلاً من إسقاط قائمة المواعيد بأكملها؛ ويمنع مشروع فحص WebKit وقوع أي انتكاسات مستقبلية.

**إذا لم تكن المشكلة متعلقة بنوع المتصفح**، فإن نفس المنهجية تطبق على المتهمين الآخرين:
- **اللغة والمنطقة الزمنية (Locale/Timezone):** مشاكل قراءة ننواتج `toLocaleString`، أو فجوات التوقيت الصيفي DST (موعد في 02:30 غير موجود في يوم تبديل الساعة)، أو اختلافات `Intl`.
- **أعلام الميزات (Feature flags) وتجارب A/B:** مقارنة معدل الخطأ لكل نسخة وتأكيد المشكلة بفرض العلم محلياً.
- **إضافات المتصفح (Browser Extensions):** إضافات الترجمة وحواجب الإعلانات التي تعدل الـ DOM وتتسبب في أخطاء ترطيب React hydration.
- **هيكل البيانات (Data shape):** مستخدم يمتلك مصفوفة فارغة، أو اسماً بالغ الطول، أو حقلاً بقيمة null غير متوقعة.

## How to say it in the interview

- "أبدأ من البيانات الميدانية، وليس من جهازي الشخصي: أقسم الجلسات المتأثرة وأقارنها بالسليمة عبر أبعاد المتصفح، ونظام التشغيل، والمنطقة الزمنية، والأعلام، والإصدار، وإضافات المتصفح حتى يبرز البُعد الشاذ بوضوح."
- "ثم أستخدم تسجيل الجلسات ومسار التتبع لاستخراج المدخل المسبب، وإعادة إنتاجه على بيئة مطابقة، وتثبيته باختبار فاشل قبل كتابة الحل."
- فخ المقابلة: "ماذا لو تعذر الإنتاج رغم كل ذلك؟" - أطلق سجلات تتبع موجهة (Targeted Logging) لجمع قيم المدخلات الحقيقية (بشكل آمن ودون بيانات شخصية PII) لاختبار الفرضية، مع وضع آليات دفاعية بديلة (fallbacks) تمنع تعطل تجربة المستخدمين ريثما يتم الحل.
- المفاضلة (Trade-off): تسجيل الجلسات والسجلات المكثفة ترفع التكاليف وتثير مخاوف الخصوصية؛ لذا يجب أخذ عينات محدودة، وحجب حقول الإدخال، وتفعيل التسجيل الموسع فقط عند وقوع الأخطاء.
