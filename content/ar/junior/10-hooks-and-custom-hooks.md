# ما هي خطافات React (الـ Hooks)، وكيف تنشئ Custom Hook؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- ما هي خطافات React (الـ Hooks)؟ وكيف تنشئ Custom Hooks؟

## The concept (short answer)
- **الخطافات (الـ Hooks)** هي دوال تبدأ بالسابقة `use` تتيح للمكونات الدالية استخدام قدرات وميزات React المتنوعة: إدارة الحالة (`useState` و `useReducer`)، والآثار الجانبية (`useEffect`)، والمراجع والمؤشرات (`useRef`)، والسياق المشترك (`useContext`)، والحفظ المؤقت لتحسين الأداء (`useMemo` و `useCallback`)، وغيرها.
- تخزن React بيانات الخطافات لكل مكون في قائمة مرتبة داخلياً وتطابقها **بناءً على ترتيب استدعائها** في كل عملية تصيير. ومن هنا نشأت **قواعد الخطافات (Rules of Hooks)** الصارمة:
  1. استدعاء الخطافات في **المستوى الأعلى (top level)** فقط: يُحظر تماماً استدعاؤها داخل الشروط (`if`) أو الحلقات التكرارية أو الدوال المتداخلة أو بعد أي عبارة `return` مبكرة.
  2. استدعاء الخطافات من **المكونات الدالية في React أو من خطافات مخصصة أخرى فقط**، وليس من الدوال العادية أو معالجات الأحداث.
- **الخطاف المخصص (Custom Hook)** هو دالة تنشئها بنفسك يبدأ اسمها بـ `use` وتستدعي داخلها خطافات React أخرى. تتيح لك **إعادة استخدام المنطق الحامل للحالة (stateful logic)** (وليس واجهة المستخدم UI) بين عدة مكونات.
- يحصل كل مكون يستدعي خطافاً مخصصاً على **حالته المستقلة الخاصة به تماماً**. فالخطافات المخصصة تشارك المنطق الرياضي والبرمجي، ولا تشارك البيانات نفسها.
- إضافة ESLint المسماة `eslint-plugin-react-hooks` تفرض هذه القواعد تلقائياً وتنبهك عند نسيان اعتماديات الـ effect.

## Real-life example: the problem
تخيّل موقعاً إخبارياً تحتاج فيه صفحة المقال وقسم التعليقات كلاهما إلى معرفة ما إذا كان الزائر يتصفح عبر شاشة هاتف محمول، كما تحتاج النافذة المنبثقة للنشرة البريدية إلى نفس المعلومة. تم نسخ كود الاستماع للحدث `resize` ولصقه في المكونات الثلاثة؛ فنسيت إحدى النسخ إزالة المستمع عند تفكيك المكون، مما جعل الموقع **أبطأ مع كل تنقل بين الصفحات**. بينما وضعت نسخة أخرى الخطاف داخل شرط `if`، فتسبب تسجيل دخول المستخدم أثناء الجلسة في **انهيار التطبيق تماماً** بالخطأ "Rendered more hooks than during the previous render".

```jsx
// BROKEN: ArticlePage.jsx
import { useEffect, useState } from 'react';

export function ArticlePage({ article, user }) {
  if (!article) return <p>Loading...</p>;      // خروج مبكر بـ return قبل استدعاء الخطافات!

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    // غياب التنظيف -> يبقى المستمع عالقاً بعد إلغاء تركيب المكون
  }, []);

  if (user) {
    const [saved, setSaved] = useState(false); // خطاف داخل جملة شرطية!
  }

  return isMobile ? <MobileArticle article={article} /> : <DesktopArticle article={article} />;
}
```

عندما يتغير `article` من `undefined` إلى بيانات محملة، أو يتغير `user` من `null` إلى مستخدم مسجل، يتغير عدد وترتيب الخطافات بين التصيير والآخر، فتعجز React عن مطابقة بياناتها المخزنة وترمي خطأ يوقف التطبيق.

## How to fix it
استخرج المنطق القابل لإعادة الاستخدام في خطاف مخصص (Custom Hook) مع تنظيف سليم للمستمع، واستدعِ كل خطاف دائماً في المستوى الأعلى قبل أي `return` مبكر.

```jsx
// FIXED: hooks/useMediaQuery.js
import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);

    setMatches(mql.matches);                    // مزامنة فورية في حال تغيرت قيمة query
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange); // تنظيف المستمع
  }, [query]);

  return matches;
}
```

```jsx
// FIXED: ArticlePage.jsx
import { useState } from 'react';
import { useMediaQuery } from './hooks/useMediaQuery';

export function ArticlePage({ article, user }) {
  const isMobile = useMediaQuery('(max-width: 767px)'); // استدعاء في المستوى الأعلى
  const [saved, setSaved] = useState(false);            // استدعاء دائم في المستوى الأعلى

  if (!article) return <p>Loading...</p>;               // return بعد اكتمال جميع الخطافات

  return (
    <>
      {user && (
        <button onClick={() => setSaved(true)} disabled={saved}>
          {saved ? 'Saved' : 'Save for later'}
        </button>
      )}
      {isMobile ? <MobileArticle article={article} /> : <DesktopArticle article={article} />}
    </>
  );
}

// يمكن إعادة استخدامه في أي مكان، ولكل مكون نسخته المستقلة تماماً:
// const isMobile = useMediaQuery('(max-width: 767px)');
// const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
```

لماذا ينجح هذا الحل: تُستدعى الخطافات الآن بنفس الترتيب الثابت في كل عملية تصيير، فتطابق React حالتها المخزنة بنجاح. وانتقلت الشروط إلى كود الـ JSX، وليس حول استدعاءات الخطافات. ويجمع الخطاف المخصص المستمع وتنظيفه في مكان واحد فلا ينساه أي مكون. كما أن `matchMedia` لا تُطلق الأحداث إلا عند تجاوز نقطة التوقف، وليس مع كل بكسل أثناء تغيير حجم الشاشة.

خطاف مخصص آخر شائع وبسيط للغاية:

```jsx
import { useCallback, useState } from 'react';

export function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn((v) => !v), []);
  return [on, toggle];
}
```

ولجلب البيانات (Data fetching)، يُفضل دائماً الاعتماد على مكتبات جاهزة (مثل TanStack Query أو SWR) بدلاً من كتابة خطاف `useFetch` يدوياً.

## How to say it in the interview
- "تتيح الخطافات للمكونات الدالية استخدام الـ state والآثار الجانبية والمراجع والسياق. وتتبعها React حسب ترتيب الاستدعاء، لذلك يجب استدعاؤها في المستوى الأعلى دائماً وبنفس الترتيب."
- "الخطاف المخصص هو دالة تبدأ بـ `use` وتستدعي خطافات أخرى؛ يشارك المنطق البرمجي وليس البيانات، وكل مكون يستخدمه يمتلك نسخته المنفصلة من الحالة."
- فخ المقابلة: وضع خطاف بعد جملة `return` مبكرة أو داخل `if` يكسر ترتيب الاستدعاء ويسبب أخطاء 'Rendered more/fewer hooks'.
- المفاضلة: تجنب تحويل كل سطر بسيط إلى خطاف مخصص؛ استخرج الخطاف عندما يتكرر المنطق أو عندما يجعل قراءة المكون أكثر سهولة ووضوحاً. واحرص على إخفاء الآثار الجانبية والتنظيف داخل الخطاف حتى لا يُساء استخدامها.
