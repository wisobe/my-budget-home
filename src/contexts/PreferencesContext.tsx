import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import i18n from '@/i18n';
import { preferencesApi } from '@/lib/api';

interface Preferences {
  darkMode: boolean;
  autoSync: boolean;
  showPending: boolean;
  language: string;
  balanceAccounts: string[];
  consentDataCollection: boolean;
  consentDataProcessing: boolean;
  consentDataStorage: boolean;
  consentRecorded: boolean;
}

interface PreferencesContextType extends Preferences {
  setDarkMode: (v: boolean) => void;
  setAutoSync: (v: boolean) => void;
  setShowPending: (v: boolean) => void;
  setLanguage: (v: string) => void;
  setBalanceAccounts: (v: string[]) => void;
  setConsentDataCollection: (v: boolean) => void;
  setConsentDataProcessing: (v: boolean) => void;
  setConsentDataStorage: (v: boolean) => void;
  isLoaded: boolean;
}

const defaults: Preferences = {
  darkMode: false,
  autoSync: true,
  showPending: true,
  language: 'en',
  balanceAccounts: [],
  consentDataCollection: false,
  consentDataProcessing: false,
  consentDataStorage: false,
  consentRecorded: false,
};

function fromApi(data: Record<string, string>): Partial<Preferences> {
  const p: Partial<Preferences> = {};
  if (data.dark_mode !== undefined) p.darkMode = data.dark_mode === '1';
  if (data.auto_sync !== undefined) p.autoSync = data.auto_sync === '1';
  if (data.show_pending !== undefined) p.showPending = data.show_pending === '1';
  if (data.language !== undefined) p.language = data.language;
  if (data.balance_accounts !== undefined) p.balanceAccounts = data.balance_accounts ? data.balance_accounts.split(',') : [];
  if (data.consent_data_collection !== undefined) { p.consentDataCollection = data.consent_data_collection === '1'; p.consentRecorded = true; }
  if (data.consent_data_processing !== undefined) { p.consentDataProcessing = data.consent_data_processing === '1'; p.consentRecorded = true; }
  if (data.consent_data_storage !== undefined) { p.consentDataStorage = data.consent_data_storage === '1'; p.consentRecorded = true; }
  return p;
}

function toApi(prefs: Preferences): Record<string, string> {
  return {
    dark_mode: prefs.darkMode ? '1' : '0',
    auto_sync: prefs.autoSync ? '1' : '0',
    show_pending: prefs.showPending ? '1' : '0',
    language: prefs.language,
    balance_accounts: prefs.balanceAccounts.join(','),
    consent_data_collection: prefs.consentDataCollection ? '1' : '0',
    consent_data_processing: prefs.consentDataProcessing ? '1' : '0',
    consent_data_storage: prefs.consentDataStorage ? '1' : '0',
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
  const setBalanceAccounts = useCallback((v: string[]) => setPrefs(p => ({ ...p, balanceAccounts: v })), []);
  const setConsentDataCollection = useCallback((v: boolean) => setPrefs(p => ({ ...p, consentDataCollection: v, consentRecorded: true })), []);
  const setConsentDataProcessing = useCallback((v: boolean) => setPrefs(p => ({ ...p, consentDataProcessing: v, consentRecorded: true })), []);
  const setConsentDataStorage = useCallback((v: boolean) => setPrefs(p => ({ ...p, consentDataStorage: v, consentRecorded: true })), []);

  return (
    <PreferencesContext.Provider value={{ ...prefs, setDarkMode, setAutoSync, setShowPending, setLanguage, setBalanceAccounts, setConsentDataCollection, setConsentDataProcessing, setConsentDataStorage, isLoaded }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
