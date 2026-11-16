# What actually breaks when you use the array index as a key?

**Level:** Mid
**Merged from (original phrasings):**
- What actually breaks when you use the array index as a key?

## The concept (short answer)
- React uses `key` to match elements between renders: "the component with key X last time is the same one with key X now". It keeps that component's **state, DOM node and refs**, and only updates its props.
- With `key={index}`, the key describes the **position**, not the **item**. When you insert at the top, delete from the middle, sort or filter, the item at index 2 changes, but React thinks "key 2 is still the same component".
- What breaks:
  - **Local state sticks to the wrong row**: checkbox `checked`, "expanded" flag, edit mode.
  - **Uncontrolled inputs keep old text**: the DOM `<input>` is reused, so the typed text stays in place while the labels move.
  - **Focus, scroll position, animations and media** (a playing `<video>`) stay at the position, not with the item.
  - **Performance**: inserting at the top changes the props of every row, so all rows re-render instead of one being added.
- Index keys are OK only if the list is **static**: never reordered, filtered, or inserted into (except at the end), and items have no state.
- Use a **stable unique ID from the data** (database ID, slug). Generate the ID when the item is **created** (`crypto.randomUUID()`), never during render.

## Real-life example: the problem
A project management tool has a to-do list per task. Each row has an uncontrolled "note" input and a local "done" checkbox state. New to-dos are added at the **top**. A user ticks "Order materials" as done and writes "call the supplier" in its note, then adds a new to-do "Book venue". Now "Book venue" shows as done with the note "call the supplier", and "Order materials" is unticked with an empty note. The user saves, and the wrong notes are sent to the server.

```jsx
function TodoRow({ todo }) {
  const [done, setDone] = useState(false); // local state per row
  return (
    <li>
      <input type="checkbox" checked={done} onChange={() => setDone(!done)} />
      <span>{todo.title}</span>
      <input name={`note-${todo.id}`} placeholder="Note" /> {/* uncontrolled */}
    </li>
  );
}

function TodoList() {
  const [todos, setTodos] = useState([{ id: 'a1', title: 'Order materials' }]);

  const addTodo = (title) =>
    setTodos((prev) => [{ id: crypto.randomUUID(), title }, ...prev]); // added at the top

  return (
    <ul>
      {todos.map((todo, index) => (
        <TodoRow key={index} todo={todo} /> // BUG: key = position
      ))}
    </ul>
  );
}
```
What React sees after adding "Book venue" at the top:
```
before: key 0 -> "Order materials" (done=true, note="call the supplier")
after:  key 0 -> "Book venue"       -> same component reused: done=true, note kept
        key 1 -> "Order materials"  -> NEW component: done=false, empty note
```

## How to fix it
```jsx
function TodoRow({ todo, onToggle }) {
  return (
    <li>
      <input type="checkbox" checked={todo.done} onChange={onToggle} />
      <span>{todo.title}</span>
      <input name={`note-${todo.id}`} placeholder="Note" />
    </li>
  );
}

function TodoList() {
  const [todos, setTodos] = useState([{ id: 'a1', title: 'Order materials', done: false }]);

  const addTodo = (title) =>
    setTodos((prev) => [{ id: crypto.randomUUID(), title, done: false }, ...prev]); // ID created once

  const toggle = (id) =>
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  return (
    <ul>
      {todos.map((todo) => (
        <TodoRow key={todo.id} todo={todo} onToggle={() => toggle(todo.id)} />
      ))}
    </ul>
  );
}
```
Why it works: the key now belongs to the item. When a new item is added at the top, React sees one new key and creates one new row. All existing rows keep their own DOM nodes, input text and state. Moving `done` into the list data (lifting state up) also makes it survive filtering and saving.

Bad "fixes" to avoid:
- `key={Math.random()}` or `key={crypto.randomUUID()}` in render: a new key every render, so every row is unmounted and remounted. State and focus are lost on every keystroke.
- `key={todo.title}`: titles are not unique, so duplicates cause warnings and mixed-up rows.

### Useful trick: key to reset state on purpose
```jsx
<EditProfileForm key={selectedUserId} user={user} /> // switching user = fresh form state
```

## How to say it in the interview
- "The key is the identity of the component. Index keys tie identity to position, so on insert, delete or sort, state and DOM stay at the position while the data moves."
- "It's fine for static lists that never change order and have no state. Otherwise I use a stable ID from the data, created when the item is created."
- Trap: "React warns only when keys are missing, not when they are indexes", so the bug is silent until someone sorts or inserts.
- Trade-off/follow-up: changing a key on purpose is a clean way to reset a component's state, but it also remounts the whole subtree, which costs performance.
