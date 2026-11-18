# ما الفرق بين المكونات المبنية على الفئات (Class Components) والمكونات الدالية (Functional Components)؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- اشرح الفرق بين المكونات المبنية على الفئات والمكونات الدالية.

## The concept (short answer)
- ترث **مكونات الفئات (Class Components)** من `React.Component`، وتحتفظ بحالتها في `this.state`، وتحدثها عبر `this.setState`، وتعتمد على **دوال دورة الحياة (lifecycle methods)** مثل (`componentDidMount` و `componentDidUpdate` و `componentWillUnmount`). كما تتطلب وجود دالة `()render`.
- **المكونات الدالية (Functional Components)** هي دوال عادية تستقبل الـ props وتُرجع كود JSX. ومنذ إطلاق React 16.8، تستخدم **الخطافات (الـ Hooks)** لإدارة الحالة (`useState`)، والآثار الجانبية (`useEffect`)، والمراجع (`useRef`)، والسياق (`useContext`)، وغيرها.
- لماذا أصبحت المكونات الدالية هي المعيار القياسي الحديث:
  - أسطر برمجية أقل، وبلا مشاكل في ربط سياق `this`.
  - اجتماع المنطق المترابط معاً داخل خطاف `useEffect` واحد بدلاً من تشتيته عبر 3 دوال دورة حياة مختلفة.
  - إمكانية إعادة استخدام المنطق بسهولة عبر **الخطافات المخصصة (custom hooks)** (بدلاً من الأنماط القديمة المعقدة كـ HOCs أو render props).
  - ميزات React الحديثة (Server Components و `use` و `useTransition` و React Compiler) مصممة بالكامل للمكونات الدالية.
- تلتقط المكونات الدالية **الـ props والـ state الخاصة بكل تصيير** عبر الـ closures. بينما تقرأ الفئات `this.props` في لحظة التنفيذ الحالية، والتي قد تكون أحدث وغير متزامنة مع ما يتوقعه المستخدم.
- ما زالت مكونات الفئات تعمل في React وتظهر في المشاريع القديمة. وهناك حالة واحدة ما زالت تتطلب فئة: **حدود الأخطاء (Error Boundaries)** (`componentDidCatch` / `getDerivedStateFromError`)، أو استخدام مكتبة مثل `react-error-boundary`.

## Real-life example: the problem
تخيّل صفحة للنتائج الرياضية المباشرة تحتوي على مكون فئة باسم `ScoreBoard` يشترك في اتصال WebSocket للمباراة المحددة. عندما ينتقل المستخدم من المباراة (أ) إلى المباراة (ب)، استمرت **أهداف المباراة (أ) بالظهور فجأة** على شاشة المباراة (ب). وبعد تصفح عدة مباريات، أصبح التبويب بطيئاً جداً لأن العديد من قنوات الاتصال بالـ socket ظلت مفتوحة في الخلفية دون إغلاق. وعند النقر على زر "Follow"، تعطل التطبيق بالخطأ `TypeError: Cannot read properties of undefined (reading 'setState')`.

```jsx
// BROKEN: ScoreBoard.jsx (class)
import React from 'react';

export class ScoreBoard extends React.Component {
  state = { score: null, following: false };

  componentDidMount() {
    this.socket = openMatchSocket(this.props.matchId);
    this.socket.onmessage = (e) => this.setState({ score: JSON.parse(e.data) });
  }
  // غياب componentDidUpdate: عند تغير matchId يستمر الاتصال القديم
  // غياب componentWillUnmount: لا يتم إغلاق الـ socket نهائياً

  handleFollow() {
    this.setState({ following: true }); // سياق `this` غير معرف: لم يتم ربط الدالة
  }

  render() {
    return (
      <div>
        <h2>{this.state.score ? `${this.state.score.home} - ${this.state.score.away}` : 'Loading...'}</h2>
        <button onClick={this.handleFollow}>Follow</button>
      </div>
    );
  }
}
```

## How to fix it
إعادة كتابة المكون كمكون دالي. خطاف `useEffect` واحد مع تحديد `matchId` في مصفوفة الاعتماديات يعالج الاشتراك، وإعادة الاشتراك، وإلغاء الاشتراك في مكان موحد.

```jsx
// FIXED: ScoreBoard.jsx (functional component)
import { useEffect, useState } from 'react';

export function ScoreBoard({ matchId }) {
  const [score, setScore] = useState(null);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    setScore(null); // مسح نتيجة المباراة القديمة أثناء جلب الجديدة
    const socket = openMatchSocket(matchId);
    socket.onmessage = (e) => setScore(JSON.parse(e.data));

    return () => socket.close(); // تعمل عند الـ unmount وقبل إعادة التشغيل لـ matchId جديد
  }, [matchId]);

  return (
    <div>
      <h2>{score ? `${score.home} - ${score.away}` : 'Loading...'}</h2>
      <button onClick={() => setFollowing(true)} disabled={following}>
        {following ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}
```

لماذا ينجح هذا الحل: يعتمد الـ effect على `matchId`. وعندما تتغير قيمته، تشغل React دالة التنظيف أولاً (فتغلق الـ socket القديم)، ثم تعيد تشغيل الـ effect للمباراة الجديدة. وعند إزالة المكون تعمل دالة التنظيف أيضاً. ولا يوجد سياق `this`، مما يستحيل معه أن يفقد معالج النقر سياقه.

وإذا كنت مجبراً على إبقاء الفئة، فإن الحل هو: إضافة `componentDidUpdate(prevProps)` لمقارنة `matchId` وإعادة الاشتراك، وإضافة `componentWillUnmount` لإغلاق الاتصال، وربط المعالج بالصيغة السهمية كحقل فئة (`handleFollow = () => {...}`).

جدول المقارنة السريعة:

| مكونات الفئات (Class) | المكونات الدالية (Function) |
|---|---|
| `this.state` / `this.setState` | `useState` / `useReducer` |
| `componentDidMount` + `componentDidUpdate` + `componentWillUnmount` | `useEffect` مع مصفوفة الاعتماديات ودالة التنظيف |
| `shouldComponentUpdate` / `PureComponent` | `React.memo` |
| `createRef` | `useRef` |
| `static contextType` | `useContext` |

## How to say it in the interview
- "تستخدم مكونات الفئات `this.state` ودوال دورة الحياة؛ بينما المكونات الدالية هي دوال بسيطة تستخدم الـ Hooks. واليوم أكتب دائماً مكونات دالية لأنها أوضح، وتتفادى سياق `this`، وتتيح إعادة استخدام المنطق عبر الـ custom hooks."
- "لا أعتبر `useEffect` مجرد بديل لدوال دورة الحياة؛ بل أفكر بها كطريقة لـ 'المزامنة مع نظام خارجي عند تغير اعتماديات معينة'، مع ضمان التنظيف السليم."
- سؤال المتابعة: "هل هناك ما يتطلب مكون فئة حتى اليوم؟" نعم، مكونات حدود الأخطاء (Error Boundaries) (أو استخدام مكتبة جاهزة مثل `react-error-boundary`).
- المفاضلة: ترحيل المشاريع الضخمة القائمة على الفئات له تكلفة ووقت؛ والنهج الأمثل هو كتابة الكود الجديد بالمكونات الدالية وتحويل القديم تدريجياً أثناء صيانته وتطويره.
