import React, { createContext, useContext, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { USE_MOCK_DATA } from '@/lib/config';

type PlaidEnvironment = 'sandbox' | 'production';

interface MockDataContextType {
  useMockData: boolean;
  setUseMockData: (value: boolean) => void;
  plaidEnvironment: PlaidEnvironment;
  setPlaidEnvironment: (value: PlaidEnvironment) => void;
}

const MockDataContext = createContext<MockDataContextType | undefined>(undefined);

function getStoredValue(): boolean {
  try {
    const stored = localStorage.getItem('use_mock_data');
    if (stored !== null) return stored === 'true';
  } catch {
    // localStorage not available
  }
  return USE_MOCK_DATA; // fall back to build-time default
}

function getStoredPlaidEnv(): PlaidEnvironment {
  try {
    const stored = localStorage.getItem('plaid_environment');
    if (stored === 'sandbox' || stored === 'production') return stored;
  } catch {
    // localStorage not available
  }
  return 'sandbox';
}

export function MockDataProvider({ children }: { children: React.ReactNode }) {
  const [useMockData, setUseMockDataState] = useState<boolean>(getStoredValue);
  const [plaidEnvironment, setPlaidEnvState] = useState<PlaidEnvironment>(getStoredPlaidEnv);
  const queryClient = useQueryClient();

  const setUseMockData = useCallback((value: boolean) => {
    setUseMockDataState(value);
    try {
      localStorage.setItem('use_mock_data', String(value));
    } catch {
      // localStorage not available
    }
    // Invalidate all queries so they refetch with the new data source
    queryClient.invalidateQueries();
  }, [queryClient]);

  const setPlaidEnvironment = useCallback((value: PlaidEnvironment) => {
    setPlaidEnvState(value);
    try {
      localStorage.setItem('plaid_environment', value);
    } catch {
      // localStorage not available
    }
    // Invalidate plaid-related queries
    queryClient.invalidateQueries({ queryKey: ['plaid-connections'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  }, [queryClient]);

  return (
    <MockDataContext.Provider value={{ useMockData, setUseMockData, plaidEnvironment, setPlaidEnvironment }}>
      {children}
    </MockDataContext.Provider>
  );
}

export function useMockDataSetting() {
  const context = useContext(MockDataContext);
  if (!context) {
    throw new Error('useMockDataSetting must be used within a MockDataProvider');
  }
  return context;
}
