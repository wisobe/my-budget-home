import { useQuery } from '@tanstack/react-query';
import { accountsApi } from '@/lib/api';
import { mockAccounts } from '@/lib/mock-data';
import { USE_MOCK_DATA } from '@/lib/config';

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        return { data: mockAccounts, success: true };
      }
      return accountsApi.list();
    },
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: ['account', id],
    queryFn: async () => {
      if (USE_MOCK_DATA) {
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
