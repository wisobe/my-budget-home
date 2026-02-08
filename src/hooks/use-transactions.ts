import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi } from '@/lib/api';
import { mockTransactions, mockCategories } from '@/lib/mock-data';
import type { Transaction } from '@/types';
import { useMockDataSetting } from '@/contexts/MockDataContext';

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
  const { useMockData, plaidEnvironment } = useMockDataSetting();
  return useQuery({
    queryKey: ['transactions', params, useMockData, plaidEnvironment],
    queryFn: async () => {
      if (useMockData) {
        let filtered = [...mockTransactions];
        
        if (params.account_id) {
          filtered = filtered.filter(t => t.account_id === params.account_id);
        }
        if (params.category_id) {
          filtered = filtered.filter(t => t.category_id === params.category_id);
        }
        if (params.search) {
          const search = params.search.toLowerCase();
          filtered = filtered.filter(t => 
            t.name.toLowerCase().includes(search) ||
            t.merchant_name?.toLowerCase().includes(search)
          );
        }
        if (params.start_date) {
          filtered = filtered.filter(t => t.date >= params.start_date!);
        }
        if (params.end_date) {
          filtered = filtered.filter(t => t.date <= params.end_date!);
        }

        const page = params.page || 1;
        const perPage = params.per_page || 20;
        const start = (page - 1) * perPage;
        const paged = filtered.slice(start, start + perPage);

        return {
          data: paged,
          total: filtered.length,
          page,
          per_page: perPage,
          total_pages: Math.ceil(filtered.length / perPage),
        };
      }
      return transactionsApi.list({ ...params, plaid_environment: plaidEnvironment });
    },
  });
}

export function useTransaction(id: string) {
  const { useMockData } = useMockDataSetting();
  return useQuery({
    queryKey: ['transaction', id, useMockData],
    queryFn: async () => {
      if (useMockData) {
        const transaction = mockTransactions.find(t => t.id === id);
        if (!transaction) throw new Error('Transaction not found');
        return { data: transaction, success: true };
      }
      return transactionsApi.get(id);
    },
    enabled: !!id,
  });
}

export function useCategorizeTransaction() {
  const queryClient = useQueryClient();
  const { useMockData } = useMockDataSetting();

  return useMutation({
    mutationFn: async ({ id, category_id }: { id: string; category_id: string }) => {
      if (useMockData) {
        const transaction = mockTransactions.find(t => t.id === id);
        if (transaction) {
          transaction.category_id = category_id;
        }
        return { data: transaction as Transaction, success: true };
      }
      return transactionsApi.categorize(id, category_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useCategories() {
  const { useMockData } = useMockDataSetting();
  return useQuery({
    queryKey: ['categories', useMockData],
    queryFn: async () => {
      if (useMockData) {
        return { data: mockCategories, success: true };
      }
      const { categoriesApi } = await import('@/lib/api');
      return categoriesApi.list();
    },
  });
}
