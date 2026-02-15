import React, { createContext, useContext, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

type PlaidEnvironment = 'sandbox' | 'production';

interface PlaidEnvironmentContextType {
  plaidEnvironment: PlaidEnvironment;
  setPlaidEnvironment: (value: PlaidEnvironment) => void;
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

  const setPlaidEnvironment = useCallback((value: PlaidEnvironment) => {
    setPlaidEnvState(value);
    try {
      localStorage.setItem('plaid_environment', value);
    } catch {
      // localStorage not available
    }
    queryClient.invalidateQueries();
  }, [queryClient]);

  return (
    <PlaidEnvironmentContext.Provider value={{ plaidEnvironment, setPlaidEnvironment }}>
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
