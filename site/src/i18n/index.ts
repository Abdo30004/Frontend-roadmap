import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import en from './en';
import fr from './fr';
import ar from './ar';

export type Lang = 'en' | 'fr' | 'ar';
export const LANGS: Lang[] = ['en', 'fr', 'ar'];
const STORAGE_KEY = 'ffg:lang';

/** ?lang=ar in the URL wins (shareable links), then the saved choice, then the browser language. */
function detect(): Lang {
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q === 'en' || q === 'fr' || q === 'ar') return q;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'fr' || saved === 'ar') return saved;
  } catch {
    /* storage blocked: fall through */
  }
  if (navigator.language?.toLowerCase().startsWith('ar')) return 'ar';
  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr }, ar: { translation: ar } },
  lng: detect(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

function sync(lng: string) {
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
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
  const lang = inst.resolvedLanguage;
  return lang === 'ar' || lang === 'fr' ? lang : 'en';
}

export function setLang(lang: Lang) {
  void i18n.changeLanguage(lang);
}
