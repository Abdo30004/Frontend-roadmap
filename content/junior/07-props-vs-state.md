# What is the difference between props and state in React?

**Level:** Junior
**Merged from (original phrasings):**
- Explain the difference between props and state in React.

## The concept (short answer)
- **Props** are inputs a component receives **from its parent**, like function arguments. They are **read-only** inside the child: the child must never change them.
- **State** is data a component **owns and manages itself** (with `useState` / `useReducer`). It can change over time, usually because of user actions or data loading.
- Changing state with the setter (`setX`) tells React to **re-render** the component. When a parent re-renders with new props, the child re-renders too.
- Data flows **one way**: down through props. A child talks back to the parent by calling a **function passed as a prop** (e.g. `onChange`).
- If two components need the same data, **lift the state up** to their closest common parent and pass it down as props.
- Do not copy props into state ("derived state") unless you really want only the initial value; compute it during render instead.

| | Props | State |
|---|---|---|
| Who owns it | parent | the component itself |
| Can the component change it? | no | yes, via the setter |
| Change triggers re-render | yes (parent re-renders) | yes |

## Real-life example: the problem
Imagine a hotel-booking site. The page shows a `RoomPicker` and, in the header, a `PriceSummary`. When the user picked a different room, the picker highlighted it but the **price in the header did not change**. Also, when the user opened a different hotel, the picker **kept showing the old hotel's selected room**.

Two bugs: the child tries to mutate a prop (React ignores it, nothing re-renders), and it copies a prop into state once, so later prop changes are ignored.

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
  // copied once on mount; ignores later changes to `hotel`
  const [selected, setSelected] = useState(booking.roomId);

  function choose(roomId) {
    setSelected(roomId);
    booking.roomId = roomId; // mutating a prop: parent does not re-render
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
Lift the selected room into **state in the parent**, pass the value down as a prop, and pass a callback so the child can ask the parent to change it.

```jsx
// FIXED
import { useState } from 'react';

function BookingPage({ hotel }) {
  const [roomId, setRoomId] = useState(hotel.rooms[0].id); // single source of truth

  return (
    <>
      <PriceSummary hotel={hotel} roomId={roomId} />
      <RoomPicker rooms={hotel.rooms} selectedId={roomId} onSelect={setRoomId} />
    </>
  );
}

function RoomPicker({ rooms, selectedId, onSelect }) {
  // no local copy: it just displays props and reports clicks
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
  const room = hotel.rooms.find((r) => r.id === roomId); // derived during render
  return <p>Total: ${room.pricePerNight}</p>;
}

// Reset all booking state when the hotel changes:
// <BookingPage key={hotel.id} hotel={hotel} />
```

Why it works: there is one source of truth (`roomId` in `BookingPage`). Calling `setRoomId` re-renders the parent, and both children get the new value as props. Giving `BookingPage` a `key={hotel.id}` makes React create a fresh component (and fresh state) when the hotel changes, so no stale selection.

Alternative: if many distant components need the same data, use React Context or a store (Zustand, Redux) instead of passing props through many levels ("prop drilling").

## How to say it in the interview
- "Props are passed in by the parent and are read-only; state is owned by the component and changed with its setter, which triggers a re-render."
- "Data flows down via props, events flow up via callback props. If siblings need the same data, I lift the state up to their common parent."
- Trap: copying props into state (`useState(props.value)`) only uses the **initial** value; later prop changes are ignored. Derive values during render or reset with a `key`.
- Trade-off: lifting state up makes more components re-render; for deep trees use composition or Context, and keep state as close as possible to where it is used.
