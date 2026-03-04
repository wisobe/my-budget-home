import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsApi } from '@/lib/api';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';
import { usePreferences } from '@/contexts/PreferencesContext';

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

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; excluded?: boolean }) => accountsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useTotalBalance() {
  const { data: accountsData } = useAccounts();
  const { balanceAccounts } = usePreferences();
  const accounts = accountsData?.data?.filter(a => !a.excluded) ?? [];

  if (balanceAccounts.length > 0) {
    return accounts
      .filter(a => balanceAccounts.includes(String(a.id)))
      .reduce((sum, a) => sum + Number(a.current_balance || 0), 0);
  }
  return accounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0);
}
