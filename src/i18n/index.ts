import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fr from './fr.json';

const savedLang = (() => {
  try {
    // Check login_language first (set by login page language toggle)
    const loginLang = localStorage.getItem('login_language');
    if (loginLang && ['en', 'fr'].includes(loginLang)) return loginLang;
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
