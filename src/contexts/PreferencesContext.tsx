import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import i18n from '@/i18n';

interface Preferences {
  darkMode: boolean;
  autoSync: boolean;
  showPending: boolean;
  language: string;
}

interface PreferencesContextType extends Preferences {
  setDarkMode: (v: boolean) => void;
  setAutoSync: (v: boolean) => void;
  setShowPending: (v: boolean) => void;
  setLanguage: (v: string) => void;
}

const STORAGE_KEY = 'app_preferences';

const defaults: Preferences = {
  darkMode: false,
  autoSync: true,
  showPending: true,
  language: 'en',
};

function loadPreferences(): Preferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch {}
  return defaults;
}

const PreferencesContext = createContext<PreferencesContextType | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  // Apply dark mode class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', prefs.darkMode);
  }, [prefs.darkMode]);

  // Sync i18n language
  useEffect(() => {
    if (i18n.language !== prefs.language) {
      i18n.changeLanguage(prefs.language);
    }
  }, [prefs.language]);

  const setDarkMode = useCallback((v: boolean) => setPrefs(p => ({ ...p, darkMode: v })), []);
  const setAutoSync = useCallback((v: boolean) => setPrefs(p => ({ ...p, autoSync: v })), []);
  const setShowPending = useCallback((v: boolean) => setPrefs(p => ({ ...p, showPending: v })), []);
  const setLanguage = useCallback((v: string) => setPrefs(p => ({ ...p, language: v })), []);

  return (
    <PreferencesContext.Provider value={{ ...prefs, setDarkMode, setAutoSync, setShowPending, setLanguage }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
