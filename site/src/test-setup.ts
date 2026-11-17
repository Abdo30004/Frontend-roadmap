// Node 25+ has its own Web Storage globals. Without a storage file they are empty, and they hide
// the ones from jsdom, so tests that use localStorage would fail. Put jsdom's back.
const { window: dom } = (globalThis as unknown as { jsdom: { window: Window } }).jsdom;
for (const name of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, name, { value: dom[name], configurable: true, writable: true });
}
