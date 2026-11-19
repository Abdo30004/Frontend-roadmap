# ما الفرق بين الـ Props والـ State في React؟

**المستوى:** مبتدئ (Junior)
**Merged from (original phrasings):**
- اشرح الفرق بين props و state في React.‏

## The concept (short answer)
- الـ **Props** هي مدخلات يستقبلها المكون **من المكون الأب**، تماماً مثل وسائط الدوال. وهي **للقراءة فقط (read-only)** داخل المكون الابن، ويُحظر عليه تعديلها نهائياً.
- الـ **State** هي بيانات **يمتلكها المكون ويديرها بنفسه محلياً** (باستخدام `useState` أو `useReducer`). ويمكن أن تتغير عبر الزمن، وعادةً ما يكون ذلك استجابةً لتفاعلات المستخدم أو استرجاع البيانات من الشبكة.
- يؤدي تعديل الـ state عبر دالة التعيين الخاصة بها (`setX`) إلى إخطار React بضرورة **إعادة تصيير (re-render)** المكون. وعندما يعيد الأب التصيير مع تمرير props جديدة، يعيد الابن التصيير تلقائياً أيضاً.
- تتدفق البيانات في **اتجاه واحد (one-way data flow)**: من الأعلى للأسفل عبر الـ props. ويتواصل الابن مع الأب عبر استدعاء **دالة ممررة إليه كـ prop** (مثل `onChange`).‏
- إذا احتاج مكونان شقيقان إلى نفس البيانات، نقوم بـ **رفع الـ state للأعلى (lifting state up)** إلى أقرب أب مشترك بينهما وتمريرها إليهما كـ props.‏
- لا تقم بنسخ الـ props داخل الـ state إلا إذا كنت ترغب في استخدامها كقيمة أولية لمرة واحدة فقط؛ واعتمد بدلاً من ذلك على حساب القيم المشتقة مباشرة أثناء التصيير.

| | الـ Props | الـ State |
|---|---|---|
| من يملكها | المكون الأب | المكون نفسه |
| هل يستطيع المكون تعديلها؟ | لا (للقراءة فقط) | نعم، عبر دالة التعيين |
| هل يسبب التغيير إعادة تصيير؟ | نعم (عند إعادة تصيير الأب) | نعم |

## Real-life example: the problem
تخيّل موقعاً لحجز الفنادق. تعرض الصفحة مكون اختيار الغرف `RoomPicker` وفي الترويسة العلوية ملخص السعر `PriceSummary`. عندما يختار المستخدم غرفة مختلفة، يحددها المكون باللون المميز ولكن **السعر في الترويسة لا يتغير نهائياً**. بالإضافة إلى ذلك، عندما يفتح المستخدم فندقاً آخر، يستمر المكون في **إظهار الغرفة المحددة من الفندق القديم**.

خطآن برمجياًن: يحاول المكون الابن تعديل الـ prop مباشرة (تتجاهلها React ولا تعيد التصيير)، كما قام بنسخ الـ prop في الـ state لمرة واحدة عند التحميل، مما جعله يتجاهل أي تغييرات مستقبلية على الفندق.

```jsx
// BROKEN
function BookingPage({ hotel }) {
  const booking = { roomId: hotel.rooms[0].id };

  return (
    <>
      <PriceSummary hotel={hotel} roomId={booking.roomId} />
      <RoomPicker hotel={hotel} booking={booking} />
    </>
  );
}

function RoomPicker({ hotel, booking }) {
  // نُسخت مرة واحدة فقط عند التركيب؛ وتتجاهل أي تغيرات تطرأ على `hotel` لاحقاً
  const [selected, setSelected] = useState(booking.roomId);

  function choose(roomId) {
    setSelected(roomId);
    booking.roomId = roomId; // تعديل الـ prop مباشرة: لا يعيد المكون الأب التصيير
  }

  return hotel.rooms.map((room) => (
    <button key={room.id} aria-pressed={room.id === selected} onClick={() => choose(room.id)}>
      {room.name}
    </button>
  ));
}

function PriceSummary({ hotel, roomId }) {
  const room = hotel.rooms.find((r) => r.id === roomId);
  return <p>Total: ${room.pricePerNight}</p>;
}
```

## How to fix it
ارفع الغرفة المحددة لتكون **state في المكون الأب**، ومرر القيمة نزولاً كـ prop، ومرر دالة رد نداء (callback) ليطلب الابن من الأب تغييرها.

```jsx
// FIXED
import { useState } from 'react';

function BookingPage({ hotel }) {
  const [roomId, setRoomId] = useState(hotel.rooms[0].id); // مصدر وحيد للحقيقة (single source of truth)

  return (
    <>
      <PriceSummary hotel={hotel} roomId={roomId} />
      <RoomPicker rooms={hotel.rooms} selectedId={roomId} onSelect={setRoomId} />
    </>
  );
}

function RoomPicker({ rooms, selectedId, onSelect }) {
  // لا توجد أي نسخة محلية: فقط يعرض الـ props ويُبلغ عن النقرات
  return rooms.map((room) => (
    <button
      key={room.id}
      aria-pressed={room.id === selectedId}
      onClick={() => onSelect(room.id)}
    >
      {room.name}
    </button>
  ));
}

function PriceSummary({ hotel, roomId }) {
  const room = hotel.rooms.find((r) => r.id === roomId); // قيمة مشتقة أثناء التصيير
  return <p>Total: ${room.pricePerNight}</p>;
}

// إعادة تعيين حالة الحجز بالكامل عند تغير الفندق:
// <BookingPage key={hotel.id} hotel={hotel} />
```

لماذا ينجح هذا الحل: يوجد مصدر وحيد للحقيقة (`roomId` في `BookingPage`). ويؤدي استدعاء `setRoomId` إلى إعادة تصيير الأب، فيحصل كلا المكونين الابنين على القيمة الجديدة كـ props. ويؤدي تزويد `BookingPage` بـ `key={hotel.id}` إلى جعل React تنشئ مكوناً جديداً تماماً (بحالة جديدة نظيفة) عند تغير الفندق، متفادية أي اختيارات قديمة عالقة.

حل بديل: إذا كانت هناك مكونات متباعدة كثيرة تحتاج نفس البيانات، فاستخدم سياق React (Context API) أو متجر إدارة حالة (Zustand أو Redux) بدلاً من تمرير الـ props عبر مستويات متعددة ("prop drilling").‏

## How to say it in the interview
- "الـ Props يمررها المكون الأب وهي للقراءة فقط؛ بينما الـ State يملكها المكون ويديرها بنفسه وتغييرها عبر دالة التعيين يطلق إعادة التصيير."
- "تتدفق البيانات للأسفل عبر الـ props، وتصعد الأحداث للأعلى عبر دوال رد النداء. وإذا احتاجت مكونات شقيقة لنفس البيانات، أقوم برفع الـ state للأب المشترك بينها."
- فخ المقابلة: نسخ الـ props داخل الـ state (`useState(props.value)`) يلتقط القيمة **الأولية** فقط؛ وتُتجاهل التغييرات اللاحقة للـ prop. احسب القيم المشتقة أثناء التصيير أو استخدم `key` لإعادة التعيين.
- المفاضلة: رفع الـ state للأعلى يزيد من المكونات التي تعيد التصيير؛ لذلك في شجرات المكونات العميقة استخدم التركيب (composition) أو الـ Context، واحتفظ بالـ state دائماً في أقرب نقطة ممكنة لمكان استخدامها.
