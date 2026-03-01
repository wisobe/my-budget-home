import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import i18n from '@/i18n';
import { preferencesApi } from '@/lib/api';

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
  isLoaded: boolean;
}

const defaults: Preferences = {
  darkMode: false,
  autoSync: true,
  showPending: true,
  language: 'en',
};

function fromApi(data: Record<string, string>): Partial<Preferences> {
  const p: Partial<Preferences> = {};
  if (data.dark_mode !== undefined) p.darkMode = data.dark_mode === '1';
  if (data.auto_sync !== undefined) p.autoSync = data.auto_sync === '1';
  if (data.show_pending !== undefined) p.showPending = data.show_pending === '1';
  if (data.language !== undefined) p.language = data.language;
  return p;
}

function toApi(prefs: Preferences): Record<string, string> {
  return {
    dark_mode: prefs.darkMode ? '1' : '0',
    auto_sync: prefs.autoSync ? '1' : '0',
    show_pending: prefs.showPending ? '1' : '0',
    language: prefs.language,
  };
}

const PreferencesContext = createContext<PreferencesContextType | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(defaults);
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoad = useRef(true);

  // Load from API on mount
  useEffect(() => {
    preferencesApi.get()
      .then(res => {
        if (res.data) {
          setPrefs(p => ({ ...p, ...fromApi(res.data) }));
        }
      })
      .catch(() => {
        // API unreachable — keep defaults
      })
      .finally(() => {
        setIsLoaded(true);
        initialLoad.current = false;
      });
  }, []);

  // Save to API on change (debounced), skip initial load
  useEffect(() => {
    if (initialLoad.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      preferencesApi.save(toApi(prefs)).catch(() => {});
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
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
    <PreferencesContext.Provider value={{ ...prefs, setDarkMode, setAutoSync, setShowPending, setLanguage, isLoaded }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
