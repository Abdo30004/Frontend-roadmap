import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOG, LEVELS } from '../catalog';
import en from './en';
import fr from './fr';
import ar from './ar';

type Tree = { [key: string]: string | Tree };

/** { a: { b: 'x' } } -> { 'a.b': 'x' } */
function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((out, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? { ...out, [path]: value } : { ...out, ...flatten(value, path) };
  }, {});
}

/** The parts of a message that code fills in: {{variables}} and <tags>. They must survive translation. */
const slots = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}|<\/?(\w+)>/g)].map((m) => m[0].replace(/\s/g, '')).sort();

const EN = flatten(en as unknown as Tree);
const FR = flatten(fr as unknown as Tree);
const AR = flatten(ar as unknown as Tree);
// French and Arabic also carry translated short labels for the map (English uses the ones in catalog.ts).
const FR_UI = Object.fromEntries(Object.entries(FR).filter(([key]) => !key.startsWith('short.')));
const AR_UI = Object.fromEntries(Object.entries(AR).filter(([key]) => !key.startsWith('short.')));

describe('translations', () => {
  it('French has every English key', () => {
    expect(Object.keys(EN).filter((key) => !(key in FR))).toEqual([]);
  });

  it('French has no key that English does not have', () => {
    expect(Object.keys(FR_UI).filter((key) => !(key in EN))).toEqual([]);
  });

  it('Arabic has every English key', () => {
    expect(Object.keys(EN).filter((key) => !(key in AR))).toEqual([]);
  });

  it('Arabic has no key that English does not have', () => {
    expect(Object.keys(AR_UI).filter((key) => !(key in EN))).toEqual([]);
  });

  it('no message is empty', () => {
    const empty = [...Object.entries(EN), ...Object.entries(FR), ...Object.entries(AR)].filter(([, v]) => v.trim() === '').map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it.each(Object.keys(EN))('"%s" keeps the same {{variables}} and <tags> in French', (key) => {
    expect(slots(FR[key] ?? '')).toEqual(slots(EN[key]));
  });

  it.each(Object.keys(EN))('"%s" keeps the same {{variables}} and <tags> in Arabic', (key) => {
    expect(slots(AR[key] ?? '')).toEqual(slots(EN[key]));
  });

  it('every question has a French short label', () => {
    const ids = LEVELS.flatMap((l) => CATALOG[l.id].map(([slug]) => `short.${l.id}/${slug}`));
    expect(ids.filter((id) => !(id in FR))).toEqual([]);
  });

  it('every question has an Arabic short label', () => {
    const ids = LEVELS.flatMap((l) => CATALOG[l.id].map(([slug]) => `short.${l.id}/${slug}`));
    expect(ids.filter((id) => !(id in AR))).toEqual([]);
  });
});

/* ---- language detection: ?lang= first, then the saved choice, then the browser language ---- */

async function detectWith({ url = '/', saved, browser = 'en-US' }: { url?: string; saved?: string; browser?: string }) {
  window.history.replaceState(null, '', url);
  if (saved) localStorage.setItem('ffg:lang', saved);
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(browser);
  vi.resetModules();
  const { default: i18n } = await import('./index');
  return i18n;
}

describe('language detection', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('uses English for an English browser', async () => {
    expect((await detectWith({})).language).toBe('en');
  });

  it('uses French for a French browser', async () => {
    expect((await detectWith({ browser: 'fr-FR' })).language).toBe('fr');
  });

  it('uses Arabic for an Arabic browser', async () => {
    expect((await detectWith({ browser: 'ar-SA' })).language).toBe('ar');
  });

  it('prefers the saved choice over the browser language', async () => {
    expect((await detectWith({ saved: 'en', browser: 'fr-CA' })).language).toBe('en');
  });

  it('prefers ?lang= over everything else', async () => {
    expect((await detectWith({ url: '/?lang=fr', saved: 'en' })).language).toBe('fr');
  });

  it('prefers ?lang=ar over everything else', async () => {
    expect((await detectWith({ url: '/?lang=ar', saved: 'en' })).language).toBe('ar');
  });

  it('ignores unknown values', async () => {
    expect((await detectWith({ url: '/?lang=de', saved: 'es' })).language).toBe('en');
  });

  it('saves the choice and updates <html lang> and <html dir> when the language changes to Arabic', async () => {
    await detectWith({});
    const { setLang } = await import('./index');
    setLang('ar');
    await vi.waitFor(() => {
      expect(document.documentElement.lang).toBe('ar');
      expect(document.documentElement.dir).toBe('rtl');
    });
    expect(localStorage.getItem('ffg:lang')).toBe('ar');
  });

  it('saves the choice and updates <html lang> and <html dir> when the language changes to French', async () => {
    await detectWith({});
    const { setLang } = await import('./index');
    setLang('fr');
    await vi.waitFor(() => {
      expect(document.documentElement.lang).toBe('fr');
      expect(document.documentElement.dir).toBe('ltr');
    });
    expect(localStorage.getItem('ffg:lang')).toBe('fr');
  });
});
