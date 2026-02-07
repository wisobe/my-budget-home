import React, { createContext, useContext, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { USE_MOCK_DATA } from '@/lib/config';

interface MockDataContextType {
  useMockData: boolean;
  setUseMockData: (value: boolean) => void;
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

export function MockDataProvider({ children }: { children: React.ReactNode }) {
  const [useMockData, setUseMockDataState] = useState<boolean>(getStoredValue);
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

  return (
    <MockDataContext.Provider value={{ useMockData, setUseMockData }}>
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
