# متى يجب استخدام useState ومتى يجب استخدام useReducer في React؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- كيف تدير الحالة (State) في React باستخدام useState و useReducer؟

## The concept (short answer)
- ترجع `useState(initial)` مصفوفة `[value, setValue]`. ويؤدي استدعاء `setValue` إلى جدولة إعادة تصيير المكون بالقيمة الجديدة. وهي الخيار الأنسب للقيم **البسيطة والمستقلة**: قيمة منطقية، أو نص، أو رقم.
- ترجع `useReducer(reducer, initialState)` مصفوفة `[state, dispatch]`. تقوم بإرسال حدث عبر `dispatch({ type: 'added', ... })` وتقوم دالة **نقية (pure function)** بصيغة `reducer(state, action)` بحساب الحالة التالية وإرجاعها. وهي الأنسب عندما تحتوي الحالة على **عدة حقول مترابطة** تتغير معاً أو **طرق متعددة للتحديث**، حيث يُجمع كل منطق التحديث في مكان واحد يسهل اختباره برمجياً.
- يجب التعامل مع الحالة دائماً كـ **قيمة غير قابلة للتعديل (immutable)**: أنشئ دائماً كائنات ومصفوفات جديدة (`{ ...state, x }`, `[...items, item]`). فإذا قمت بالتعديل على نفس المرجع، فلن تلاحظ React أي تغيير **ولن تعيد التصيير**.
- تتم معالجة تحديثات الحالة بشكل دفعي (**batched**)، وتكون القيمة الجديدة مرئية فقط في **التصيير التالي**. عندما تعتمد القيمة الجديدة على السابقة، استخدم صيغة دالة التحديث: `setCount((c) => c + 1)`.
- للعمليات المكلفة عند التهيئة الأولية، استخدم دالة كقيمة مبدئية (Lazy initialization): `useState(() => readFromLocalStorage())`.

```jsx
const [isOpen, setIsOpen] = useState(false);
setIsOpen((open) => !open);
```

## Real-life example: the problem
تخيّل سلة مشتريات لتطبيق توصيل طعام. نقر المستخدمون على زر "+" بسرعة ثلاث مرات فزادت الكمية بمقدار **1 فقط بدلاً من 3**. كما أن إضافة صنف في بعض الأحيان **لم تُحدث الشارة الرقمية** في الترويسة. وبعد إصلاح خطأ برمجي في أحد المعالجات، أصبح الإجمالي وعدد العناصر **غير متطابقين** نتيجة تكرار نفس المنطق ونسخه ولصقه عبر أربعة معالجات أحداث مختلفة.

```jsx
// BROKEN: Cart.jsx
import { useState } from 'react';

export function Cart() {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);

  function addItem(dish) {
    items.push({ ...dish, qty: 1 });  // تعديل مباشر: نفس مرجع المصفوفة -> لا إعادة تصيير
    setItems(items);
    setCount(count + 1);
    setTotal(total + dish.price);
  }

  function addThree(dish) {
    setCount(count + 1);              // تقرأ الاستدعاءات الثلاثة نفس قيمة `count` القديمة
    setCount(count + 1);
    setCount(count + 1);              // النتيجة النهائية: زيادة بمقدار 1 فقط وليس 3
  }

  function removeItem(id) {
    setItems(items.filter((i) => i.id !== id));
    setCount(count - 1);              // نسيان تحديث المجموع الإجمالي -> عدم تطابق البيانات
  }
  // ...
}
```

## How to fix it
تحتوي السلة على بيانات مترابطة يجب أن تتغير معاً، لذا يُفضل نقلها إلى reducer. وتجنب تخزين أي قيم يمكنك **اشتقاقها وحسابها** (مثل `count` و `total`)؛ بل احسبها مباشرة من مصفوفة `items`.

```jsx
// FIXED: Cart.jsx
import { useReducer } from 'react';

function cartReducer(state, action) {
  switch (action.type) {
    case 'added': {
      const existing = state.items.find((i) => i.id === action.dish.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === action.dish.id ? { ...i, qty: i.qty + action.qty } : i
          ),
        };
      }
      return { ...state, items: [...state.items, { ...action.dish, qty: action.qty }] };
    }
    case 'removed':
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case 'cleared':
      return { ...state, items: [] };
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

export function Cart() {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  // قيم مشتقة: متزامنة دائماً، ولا تُخزن في الـ state أبداً
  const count = state.items.reduce((n, i) => n + i.qty, 0);
  const total = state.items.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <section>
      <h2>Cart ({count})</h2>
      {state.items.map((item) => (
        <div key={item.id}>
          {item.name} x {item.qty}
          <button onClick={() => dispatch({ type: 'added', dish: item, qty: 1 })}>+</button>
          <button onClick={() => dispatch({ type: 'removed', id: item.id })}>Remove</button>
        </div>
      ))}
      <p>Total: ${total.toFixed(2)}</p>
    </section>
  );
}
```

لماذا ينجح هذا الحل:
- يرجع الـ reducer كائنات ومصفوفات **جديدة دائماً**، فتتعرف React على التغيير وتعيد التصيير.
- تمرر React **أحدث** نسخة من الـ state إلى الـ reducer مع كل عملية dispatch، فتؤدي النقرات السريعة الثلاث إلى إضافة 3 بنجاح.
- يتم حساب `count` و `total` مباشرة من `items`، مما يستحيل معه وقوع أي تعارض أو عدم تطابق.
- تتجمع كافة قواعد السلة في دالة نقية واحدة يسهل اختبارها باختبارات الوحدة دون الحاجة لتصيير المكون.

ولإصلاح خطأ "+3" ذاته باستخدام `useState` العادية: نستخدم دالة التحديث (updater function).

```jsx
setCount((c) => c + 1); // يستقبل كل استدعاء أحدث قيمة متوفرة
setCount((c) => c + 1);
setCount((c) => c + 1); // النتيجة: +3 بنجاح
```

## How to say it in the interview
- "أستخدم `useState` للقيم البسيطة المستقلة، و `useReducer` عندما تتغير عدة قيم معاً أو عندما تزداد تعقيدات قواعد التحديث؛ فالـ reducer يركّز المنطق ويسهل اختباره بشكل منفصل."
- "الـ State غير قابلة للتعديل المباشر: أنشئ دائماً كائنات ومصفوفات جديدة، وإلا ستقارن React المراجع البرمجية فلن تجد فرقاً وتتخطى إعادة التصيير."
- فخ المقابلة: استدعاء `setCount(count + 1)` ثلاث مرات متتالية يضيف 1 فقط، لأن `count` تقرأ قيمة التصيير الحالي. والحل هو استخدام الصيغة السهمية `setCount(c => c + 1)`.
- المفاضلة: يضيف `useReducer` بعض الأكواد الإضافية (action types و عبارات switch). واستخدامه لمجرد حقل نصي أو زر تبديل بسيط يُعتبر تعقيداً غير مبرر. كما ينبغي تجنب تخزين البيانات المشتقة في الـ state والاعتماد على حسابها المباشر.
