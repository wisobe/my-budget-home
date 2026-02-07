import { useQuery } from '@tanstack/react-query';
import { accountsApi } from '@/lib/api';
import { mockAccounts } from '@/lib/mock-data';
import { useMockDataSetting } from '@/contexts/MockDataContext';

export function useAccounts() {
  const { useMockData } = useMockDataSetting();
  return useQuery({
    queryKey: ['accounts', useMockData],
    queryFn: async () => {
      if (useMockData) {
        return { data: mockAccounts, success: true };
      }
      return accountsApi.list();
    },
  });
}

export function useAccount(id: string) {
  const { useMockData } = useMockDataSetting();
  return useQuery({
    queryKey: ['account', id, useMockData],
    queryFn: async () => {
      if (useMockData) {
        const account = mockAccounts.find(a => a.id === id);
        if (!account) throw new Error('Account not found');
        return { data: account, success: true };
      }
      return accountsApi.get(id);
    },
    enabled: !!id,
  });
}

export function useTotalBalance() {
  const { data: accountsData } = useAccounts();
  
  const totalBalance = accountsData?.data?.reduce((sum, account) => {
    return sum + account.current_balance;
  }, 0) ?? 0;

  return totalBalance;
}
