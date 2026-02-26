import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi, categoriesApi } from '@/lib/api';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';

interface UseTransactionsParams {
  page?: number;
  per_page?: number;
  account_id?: string;
  category_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  show_excluded?: boolean;
  uncategorized?: boolean;
}

export function useTransactions(params: UseTransactionsParams = {}) {
  const { plaidEnvironment } = usePlaidEnvironment();
  return useQuery({
    queryKey: ['transactions', params, plaidEnvironment],
    queryFn: () => transactionsApi.list({ ...params, plaid_environment: plaidEnvironment }),
  });
}

export function useCategorizeTransaction() {
  const queryClient = useQueryClient();
  const { plaidEnvironment } = usePlaidEnvironment();
  return useMutation({
    mutationFn: ({ id, category_id }: { id: string; category_id: string | null }) =>
      transactionsApi.categorize(id, category_id, plaidEnvironment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useExcludeTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, excluded }: { id: string; excluded: boolean }) =>
      transactionsApi.exclude(id, excluded),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      account_id: string;
      date: string;
      name: string;
      amount: number;
      category_id?: string;
      merchant_name?: string;
      notes?: string;
    }) => transactionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useTransactionSplits(transactionId: string | null) {
  return useQuery({
    queryKey: ['transaction-splits', transactionId],
    queryFn: () => transactionsApi.getSplits(transactionId!),
    enabled: !!transactionId,
  });
}

export function useSaveTransactionSplits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ transaction_id, splits }: {
      transaction_id: string;
      splits: { category_id?: string; amount: number; is_excluded?: boolean }[];
    }) => transactionsApi.saveSplits(transaction_id, splits),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-splits'] });
    },
  });
}

export function useDeleteTransactionSplits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transaction_id: string) => transactionsApi.deleteSplits(transaction_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-splits'] });
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; name?: string; color?: string; parent_id?: string | null; is_income?: boolean }) =>
      categoriesApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useCategoryRules() {
  const { plaidEnvironment } = usePlaidEnvironment();
  return useQuery({
    queryKey: ['category-rules', plaidEnvironment],
    queryFn: () => categoriesApi.listRules(plaidEnvironment),
  });
}

export function useCreateCategoryRule() {
  const queryClient = useQueryClient();
  const { plaidEnvironment } = usePlaidEnvironment();
  return useMutation({
    mutationFn: (data: { category_id: string; keyword: string; match_type?: string; priority?: number; apply_to_existing?: boolean }) =>
      categoriesApi.createRule({ ...data, plaid_environment: plaidEnvironment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-rules'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useUpdateCategoryRule() {
  const queryClient = useQueryClient();
  const { plaidEnvironment } = usePlaidEnvironment();
  return useMutation({
    mutationFn: (data: { id: string; keyword?: string; category_id?: string; match_type?: string; priority?: number; apply_to_existing?: boolean }) =>
      categoriesApi.updateRule({ ...data, plaid_environment: plaidEnvironment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-rules'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useDeleteCategoryRule() {
  const queryClient = useQueryClient();
  const { plaidEnvironment } = usePlaidEnvironment();
  return useMutation({
    mutationFn: (id: string) => categoriesApi.deleteRule(id, plaidEnvironment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-rules'] });
    },
  });
}
