import React, { createContext, useContext, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

type PlaidEnvironment = 'sandbox' | 'production';

interface PlaidEnvironmentContextType {
  plaidEnvironment: PlaidEnvironment;
  setPlaidEnvironment: (value: PlaidEnvironment) => void;
  canUseSandbox: boolean;
}

const PlaidEnvironmentContext = createContext<PlaidEnvironmentContextType | undefined>(undefined);

function getStoredPlaidEnv(): PlaidEnvironment {
  try {
    const stored = localStorage.getItem('plaid_environment');
    if (stored === 'sandbox' || stored === 'production') return stored;
  } catch {
    // localStorage not available
  }
  return 'sandbox';
}

export function PlaidEnvironmentProvider({ children }: { children: React.ReactNode }) {
  const [plaidEnvironment, setPlaidEnvState] = useState<PlaidEnvironment>(getStoredPlaidEnv);
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  // Non-admin users are locked to production
  const canUseSandbox = isAdmin;

  // If non-admin tries to use sandbox, force production
  const effectiveEnvironment = canUseSandbox ? plaidEnvironment : 'production';

  const setPlaidEnvironment = useCallback((value: PlaidEnvironment) => {
    // Non-admins can only use production
    const resolvedValue = canUseSandbox ? value : 'production';
    setPlaidEnvState(resolvedValue);
    try {
      localStorage.setItem('plaid_environment', resolvedValue);
    } catch {
      // localStorage not available
    }
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
