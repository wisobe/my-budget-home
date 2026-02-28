import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/lib/config';

type PlaidEnvironment = 'sandbox' | 'production';

interface PlaidEnvironmentContextType {
  plaidEnvironment: PlaidEnvironment;
  setPlaidEnvironment: (value: PlaidEnvironment) => void;
  canUseSandbox: boolean;
}

const PlaidEnvironmentContext = createContext<PlaidEnvironmentContextType | undefined>(undefined);

async function fetchUserPreferences(): Promise<Record<string, string>> {
  const token = sessionStorage.getItem('auth_token');
  try {
    const res = await fetch(`${API_BASE_URL}/settings/user-preferences.php`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return {};
    const json = await res.json();
    return json.data ?? {};
  } catch {
    return {};
  }
}

async function saveUserPreference(key: string, value: string) {
  const token = sessionStorage.getItem('auth_token');
  try {
    await fetch(`${API_BASE_URL}/settings/user-preferences.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ [key]: value }),
    });
  } catch {
    // silent fail
  }
}

export function PlaidEnvironmentProvider({ children }: { children: React.ReactNode }) {
  const [plaidEnvironment, setPlaidEnvState] = useState<PlaidEnvironment>('production');
  const [loaded, setLoaded] = useState(false);
  const queryClient = useQueryClient();
  const { isAdmin, isAuthenticated } = useAuth();

  const canUseSandbox = isAdmin;
  const effectiveEnvironment = canUseSandbox ? plaidEnvironment : 'production';

  // Load preference from server on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUserPreferences().then((prefs) => {
      const env = prefs.plaid_environment;
      if (env === 'sandbox' || env === 'production') {
        setPlaidEnvState(env);
      }
      setLoaded(true);
    });
  }, [isAuthenticated]);

  const setPlaidEnvironment = useCallback((value: PlaidEnvironment) => {
    const resolvedValue = canUseSandbox ? value : 'production';
    setPlaidEnvState(resolvedValue);
    saveUserPreference('plaid_environment', resolvedValue);
    queryClient.invalidateQueries();
  }, [queryClient, canUseSandbox]);

  return (
    <PlaidEnvironmentContext.Provider value={{ plaidEnvironment: effectiveEnvironment, setPlaidEnvironment, canUseSandbox }}>
      {children}
    </PlaidEnvironmentContext.Provider>
  );
}

export function usePlaidEnvironment() {
  const context = useContext(PlaidEnvironmentContext);
  if (!context) {
    throw new Error('usePlaidEnvironment must be used within a PlaidEnvironmentProvider');
  }
  return context;
}
