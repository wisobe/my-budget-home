import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface Preferences {
  darkMode: boolean;
  autoSync: boolean;
  showPending: boolean;
}

interface PreferencesContextType extends Preferences {
  setDarkMode: (v: boolean) => void;
  setAutoSync: (v: boolean) => void;
  setShowPending: (v: boolean) => void;
}

const STORAGE_KEY = 'app_preferences';

const defaults: Preferences = {
  darkMode: false,
  autoSync: true,
  showPending: true,
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

  const setDarkMode = useCallback((v: boolean) => setPrefs(p => ({ ...p, darkMode: v })), []);
  const setAutoSync = useCallback((v: boolean) => setPrefs(p => ({ ...p, autoSync: v })), []);
  const setShowPending = useCallback((v: boolean) => setPrefs(p => ({ ...p, showPending: v })), []);

  return (
    <PreferencesContext.Provider value={{ ...prefs, setDarkMode, setAutoSync, setShowPending }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
