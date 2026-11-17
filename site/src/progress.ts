import { useSyncExternalStore } from 'react';

// Per-learner progress, kept in this browser only (the site has no backend).
//  - understood: questions marked as understood / completed
//  - opened:     questions the learner has opened on the map (counts as "in progress")
//  - notes:      the learner's written answer or notes, per question

function createStore<T>(key: string, fallback: T, valid: (v: unknown) => v is T) {
  const listeners = new Set<() => void>();
  const read = (): T => {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? 'null');
      return valid(v) ? v : fallback;
    } catch {
      return fallback;
    }
  };
  let snapshot = read();
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === key) {
        snapshot = read();
        listeners.forEach((l) => l());
      }
    });
  }
  return {
    get: () => snapshot,
    set(next: T) {
      snapshot = next;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage blocked: progress just won't persist */
      }
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

const isList = (v: unknown): v is string[] => Array.isArray(v);
const isMap = (v: unknown): v is Record<string, string> => !!v && typeof v === 'object' && !Array.isArray(v);

const understood = createStore<string[]>('ffg:understood:v1', [], isList);
const opened = createStore<string[]>('ffg:opened:v1', [], isList);
const notes = createStore<Record<string, string>>('ffg:notes:v1', {}, isMap);

export type Status = 'not_started' | 'in_progress' | 'completed';

export function useProgress() {
  const done = useSyncExternalStore(understood.subscribe, understood.get);
  const seen = useSyncExternalStore(opened.subscribe, opened.get);
  const written = useSyncExternalStore(notes.subscribe, notes.get);

  const isDone = (id: string) => done.includes(id);
  return {
    done,
    isDone,
    toggle: (id: string) => understood.set(isDone(id) ? done.filter((d) => d !== id) : [...done, id]),
    status: (id: string): Status =>
      isDone(id) ? 'completed' : seen.includes(id) || (written[id] ?? '').trim() !== '' ? 'in_progress' : 'not_started',
    markOpened: (id: string) => {
      if (!seen.includes(id)) opened.set([...seen, id]);
    },
    note: (id: string) => written[id] ?? '',
    setNote: (id: string, text: string) => {
      const next = { ...written };
      if (text.trim() === '') delete next[id];
      else next[id] = text;
      notes.set(next);
    },
  };
}
