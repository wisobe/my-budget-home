import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetsApi } from '@/lib/api';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';

export function useBudgets() {
  const { plaidEnvironment } = usePlaidEnvironment();
  return useQuery({
    queryKey: ['budgets', plaidEnvironment],
    queryFn: () => budgetsApi.list(plaidEnvironment),
  });
}

export function useSaveBudget() {
  const queryClient = useQueryClient();
  const { plaidEnvironment } = usePlaidEnvironment();
  return useMutation({
    mutationFn: (data: { category_id: string; amount: number; period: string }) =>
      budgetsApi.create({ ...data, plaid_environment: plaidEnvironment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  const { plaidEnvironment } = usePlaidEnvironment();
  return useMutation({
    mutationFn: (id: string) => budgetsApi.delete(id, plaidEnvironment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}
