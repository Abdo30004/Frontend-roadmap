import { useSyncExternalStore } from 'react';

// Per-learner progress, kept in this browser only.
const KEY = 'ffg:understood:v1';
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

let snapshot = read();

function write(next: string[]) {
  snapshot = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: progress just won't persist */
  }
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      snapshot = read();
      listeners.forEach((l) => l());
    }
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useProgress() {
  const done = useSyncExternalStore(subscribe, () => snapshot);
  return {
    done,
    isDone: (id: string) => done.includes(id),
    toggle: (id: string) => write(done.includes(id) ? done.filter((d) => d !== id) : [...done, id]),
  };
}
