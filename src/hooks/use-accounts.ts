import { useQuery } from '@tanstack/react-query';
import { accountsApi } from '@/lib/api';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';

export function useAccounts() {
  const { plaidEnvironment } = usePlaidEnvironment();
  return useQuery({
    queryKey: ['accounts', plaidEnvironment],
    queryFn: () => accountsApi.list({ plaid_environment: plaidEnvironment }),
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: ['account', id],
    queryFn: () => accountsApi.get(id),
    enabled: !!id,
  });
}

export function useTotalBalance() {
  const { data: accountsData } = useAccounts();
  return accountsData?.data?.reduce((sum, account) => sum + account.current_balance, 0) ?? 0;
}
