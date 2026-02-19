import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fr from './fr.json';

const savedLang = (() => {
  try {
    const prefs = localStorage.getItem('app_preferences');
    if (prefs) {
      const parsed = JSON.parse(prefs);
      if (parsed.language) return parsed.language;
    }
  } catch {}
  return 'en';
})();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
