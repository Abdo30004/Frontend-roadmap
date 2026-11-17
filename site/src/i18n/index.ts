import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import en from './en';
import fr from './fr';

export type Lang = 'en' | 'fr';
export const LANGS: Lang[] = ['en', 'fr'];
const STORAGE_KEY = 'ffg:lang';

/** ?lang=fr in the URL wins (shareable links), then the saved choice, then the browser language. */
function detect(): Lang {
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q === 'en' || q === 'fr') return q;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'fr') return saved;
  } catch {
    /* storage blocked: fall through */
  }
  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: detect(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

function sync(lng: string) {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
}
sync(i18n.language);
i18n.on('languageChanged', sync);

export default i18n;

/** Current language, re-rendering when it changes. */
export function useLang(): Lang {
  const { i18n: inst } = useTranslation();
  return inst.resolvedLanguage === 'fr' ? 'fr' : 'en';
}

export function setLang(lang: Lang) {
  void i18n.changeLanguage(lang);
}
