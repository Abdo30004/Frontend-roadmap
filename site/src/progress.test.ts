import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The stores read localStorage when the module loads, so each test imports a fresh copy.
async function load() {
  vi.resetModules();
  const { useProgress } = await import('./progress');
  return renderHook(() => useProgress());
}

beforeEach(() => localStorage.clear());

describe('useProgress', () => {
  it('starts with nothing done', async () => {
    const { result } = await load();
    expect(result.current.done).toEqual([]);
    expect(result.current.status('junior/01-closures')).toBe('not_started');
  });

  it('marks a question as understood and back, and saves it', async () => {
    const { result } = await load();
    act(() => result.current.toggle('junior/01-closures'));
    expect(result.current.isDone('junior/01-closures')).toBe(true);
    expect(result.current.status('junior/01-closures')).toBe('completed');
    expect(JSON.parse(localStorage.getItem('ffg:understood:v1')!)).toEqual(['junior/01-closures']);

    act(() => result.current.toggle('junior/01-closures'));
    expect(result.current.status('junior/01-closures')).toBe('not_started');
    expect(JSON.parse(localStorage.getItem('ffg:understood:v1')!)).toEqual([]);
  });

  it('counts an opened question as in progress, once', async () => {
    const { result } = await load();
    act(() => result.current.markOpened('mid/07-array-index-as-key'));
    act(() => result.current.markOpened('mid/07-array-index-as-key'));
    expect(result.current.status('mid/07-array-index-as-key')).toBe('in_progress');
    expect(JSON.parse(localStorage.getItem('ffg:opened:v1')!)).toEqual(['mid/07-array-index-as-key']);
  });

  it('counts a written note as in progress, and removes empty notes', async () => {
    const { result } = await load();
    act(() => result.current.setNote('senior/01-x', 'my answer'));
    expect(result.current.note('senior/01-x')).toBe('my answer');
    expect(result.current.status('senior/01-x')).toBe('in_progress');

    act(() => result.current.setNote('senior/01-x', '   '));
    expect(result.current.note('senior/01-x')).toBe('');
    expect(result.current.status('senior/01-x')).toBe('not_started');
    expect(JSON.parse(localStorage.getItem('ffg:notes:v1')!)).toEqual({});
  });

  it('completed wins over opened', async () => {
    const { result } = await load();
    act(() => result.current.markOpened('junior/02-x'));
    act(() => result.current.toggle('junior/02-x'));
    expect(result.current.status('junior/02-x')).toBe('completed');
  });

  it('restores saved progress from a previous visit', async () => {
    localStorage.setItem('ffg:understood:v1', JSON.stringify(['junior/03-x']));
    localStorage.setItem('ffg:opened:v1', JSON.stringify(['junior/04-x']));
    const { result } = await load();
    expect(result.current.status('junior/03-x')).toBe('completed');
    expect(result.current.status('junior/04-x')).toBe('in_progress');
  });

  it('ignores broken or unexpected saved data instead of crashing', async () => {
    localStorage.setItem('ffg:understood:v1', '{not json');
    localStorage.setItem('ffg:opened:v1', JSON.stringify({ wrong: 'shape' }));
    localStorage.setItem('ffg:notes:v1', JSON.stringify(['wrong', 'shape']));
    const { result } = await load();
    expect(result.current.done).toEqual([]);
    expect(result.current.status('junior/04-x')).toBe('not_started');
    expect(result.current.note('junior/04-x')).toBe('');
  });

  it('keeps working in memory when storage is blocked', async () => {
    const { result } = await load();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    act(() => result.current.toggle('junior/05-x'));
    expect(result.current.isDone('junior/05-x')).toBe(true);
  });

  it('follows changes made in another tab', async () => {
    const { result } = await load();
    localStorage.setItem('ffg:understood:v1', JSON.stringify(['mid/01-x']));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'ffg:understood:v1' }));
    });
    expect(result.current.isDone('mid/01-x')).toBe(true);
  });
});
