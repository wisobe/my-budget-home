import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi, categoriesApi } from '@/lib/api';
import type { Transaction } from '@/types';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';

interface UseTransactionsParams {
  page?: number;
  per_page?: number;
  account_id?: string;
  category_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}

export function useTransactions(params: UseTransactionsParams = {}) {
  const { plaidEnvironment } = usePlaidEnvironment();
  return useQuery({
    queryKey: ['transactions', params, plaidEnvironment],
    queryFn: () => transactionsApi.list({ ...params, plaid_environment: plaidEnvironment }),
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: ['transaction', id],
    queryFn: () => transactionsApi.get(id),
    enabled: !!id,
  });
}

export function useCategorizeTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, category_id }: { id: string; category_id: string }) =>
      transactionsApi.categorize(id, category_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  });
}
