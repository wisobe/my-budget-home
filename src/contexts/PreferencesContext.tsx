import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import i18n from '@/i18n';
import { preferencesApi } from '@/lib/api';

const ALL_SETTINGS_SECTIONS = ['account', 'twoFactor', 'categories', 'rules', 'preferences', 'plaidEnv', 'privacy', 'export'];

export type ThemeMode = 'light' | 'dark' | 'system';

interface Preferences {
  themeMode: ThemeMode;
  autoSync: boolean;
  showPending: boolean;
  language: string;
  balanceAccounts: string[];
  consentDataCollection: boolean;
  consentDataProcessing: boolean;
  consentDataStorage: boolean;
  consentRecorded: boolean;
  settingsExpandedSections: string[];
  sidebarOrder: string[];
  accountOrder: string[];
}

interface PreferencesContextType extends Preferences {
  darkMode: boolean;
  setThemeMode: (v: ThemeMode) => void;
  setDarkMode: (v: boolean) => void;
  setAutoSync: (v: boolean) => void;
  setShowPending: (v: boolean) => void;
  setLanguage: (v: string) => void;
  setBalanceAccounts: (v: string[]) => void;
  setConsentDataCollection: (v: boolean) => void;
  setConsentDataProcessing: (v: boolean) => void;
  setConsentDataStorage: (v: boolean) => void;
  setSettingsExpandedSections: (v: string[]) => void;
  setSidebarOrder: (v: string[]) => void;
  setAccountOrder: (v: string[]) => void;
  isLoaded: boolean;
}

const defaults: Preferences = {
  themeMode: 'system',
  autoSync: true,
  showPending: true,
  language: 'en',
  balanceAccounts: [],
  consentDataCollection: false,
  consentDataProcessing: false,
  consentDataStorage: false,
  consentRecorded: false,
  settingsExpandedSections: [...ALL_SETTINGS_SECTIONS],
  sidebarOrder: [],
  accountOrder: [],
};

function fromApi(data: Record<string, string>): Partial<Preferences> {
  const p: Partial<Preferences> = {};
  if (data.dark_mode !== undefined) {
    // Support legacy '0'/'1' values and new 'light'/'dark'/'system'
    if (data.dark_mode === '0') p.themeMode = 'light';
    else if (data.dark_mode === '1') p.themeMode = 'dark';
    else if (['light', 'dark', 'system'].includes(data.dark_mode)) p.themeMode = data.dark_mode as ThemeMode;
    else p.themeMode = 'system';
  }
  if (data.auto_sync !== undefined) p.autoSync = data.auto_sync === '1';
  if (data.show_pending !== undefined) p.showPending = data.show_pending === '1';
  if (data.language !== undefined) p.language = data.language;
  if (data.balance_accounts !== undefined) p.balanceAccounts = data.balance_accounts ? data.balance_accounts.split(',') : [];
  if (data.consent_data_collection !== undefined) { p.consentDataCollection = data.consent_data_collection === '1'; p.consentRecorded = true; }
  if (data.consent_data_processing !== undefined) { p.consentDataProcessing = data.consent_data_processing === '1'; p.consentRecorded = true; }
  if (data.consent_data_storage !== undefined) { p.consentDataStorage = data.consent_data_storage === '1'; p.consentRecorded = true; }
  if (data.settings_expanded_sections !== undefined) p.settingsExpandedSections = data.settings_expanded_sections ? data.settings_expanded_sections.split(',') : [];
  if (data.sidebar_order !== undefined) p.sidebarOrder = data.sidebar_order ? data.sidebar_order.split(',') : [];
  if (data.account_order !== undefined) p.accountOrder = data.account_order ? data.account_order.split(',') : [];
  return p;
}

function toApi(prefs: Preferences): Record<string, string> {
  return {
    dark_mode: prefs.themeMode,
    auto_sync: prefs.autoSync ? '1' : '0',
    show_pending: prefs.showPending ? '1' : '0',
    language: prefs.language,
    balance_accounts: prefs.balanceAccounts.join(','),
    consent_data_collection: prefs.consentDataCollection ? '1' : '0',
    consent_data_processing: prefs.consentDataProcessing ? '1' : '0',
    consent_data_storage: prefs.consentDataStorage ? '1' : '0',
    settings_expanded_sections: prefs.settingsExpandedSections.join(','),
    sidebar_order: prefs.sidebarOrder.join(','),
  };
}

function useSystemDarkMode() {
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return systemDark;
}

const PreferencesContext = createContext<PreferencesContextType | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(defaults);
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoad = useRef(true);
  const systemDark = useSystemDarkMode();

  // Resolved dark mode value
  const darkMode = prefs.themeMode === 'system' ? systemDark : prefs.themeMode === 'dark';

  // Load from API on mount
  useEffect(() => {
    preferencesApi.get()
      .then(res => {
        const loginLang = localStorage.getItem('login_language');
        localStorage.removeItem('login_language');

        if (res.data) {
          const apiPrefs = fromApi(res.data);
          if (loginLang) {
            apiPrefs.language = loginLang;
          }
          setPrefs(p => ({ ...p, ...apiPrefs }));
        } else if (loginLang) {
          setPrefs(p => ({ ...p, language: loginLang }));
        }
      })
      .catch(() => {
        const loginLang = localStorage.getItem('login_language');
        localStorage.removeItem('login_language');
        if (loginLang) {
          setPrefs(p => ({ ...p, language: loginLang }));
        }
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
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Sync i18n language
  useEffect(() => {
    if (i18n.language !== prefs.language) {
      i18n.changeLanguage(prefs.language);
    }
  }, [prefs.language]);

  const setThemeMode = useCallback((v: ThemeMode) => setPrefs(p => ({ ...p, themeMode: v })), []);
  const setDarkMode = useCallback((v: boolean) => setPrefs(p => ({ ...p, themeMode: v ? 'dark' : 'light' })), []);
  const setAutoSync = useCallback((v: boolean) => setPrefs(p => ({ ...p, autoSync: v })), []);
  const setShowPending = useCallback((v: boolean) => setPrefs(p => ({ ...p, showPending: v })), []);
  const setLanguage = useCallback((v: string) => setPrefs(p => ({ ...p, language: v })), []);
  const setBalanceAccounts = useCallback((v: string[]) => setPrefs(p => ({ ...p, balanceAccounts: v })), []);
  const setConsentDataCollection = useCallback((v: boolean) => setPrefs(p => ({ ...p, consentDataCollection: v, consentRecorded: true })), []);
  const setConsentDataProcessing = useCallback((v: boolean) => setPrefs(p => ({ ...p, consentDataProcessing: v, consentRecorded: true })), []);
  const setConsentDataStorage = useCallback((v: boolean) => setPrefs(p => ({ ...p, consentDataStorage: v, consentRecorded: true })), []);
  const setSettingsExpandedSections = useCallback((v: string[]) => setPrefs(p => ({ ...p, settingsExpandedSections: v })), []);
  const setSidebarOrder = useCallback((v: string[]) => setPrefs(p => ({ ...p, sidebarOrder: v })), []);

  return (
    <PreferencesContext.Provider value={{ ...prefs, darkMode, setThemeMode, setDarkMode, setAutoSync, setShowPending, setLanguage, setBalanceAccounts, setConsentDataCollection, setConsentDataProcessing, setConsentDataStorage, setSettingsExpandedSections, setSidebarOrder, isLoaded }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
