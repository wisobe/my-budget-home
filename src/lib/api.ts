/**
 * API Client for the Budgeting App Backend
 * 
 * This client is designed to connect to your self-hosted MariaDB backend.
 * Configure the API_BASE_URL to point to your Apache server's API endpoint.
 */

import type {
  Transaction,
  Category,
  Account,
  PlaidConnection,
  Budget,
  SpendingInsight,
  MonthlyOverview,
  ApiResponse,
  PaginatedResponse,
  PlaidLinkToken,
  PlaidSyncResult,
} from '@/types';

import { API_BASE_URL } from '@/lib/config';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(response.status, error.message || 'Request failed');
  }

  return response.json();
}

// ============ Transactions API ============

export const transactionsApi = {
  list: (params?: {
    page?: number;
    per_page?: number;
    account_id?: string;
    category_id?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    plaid_environment?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.set(key, String(value));
      });
    }
    return request<PaginatedResponse<Transaction>>(`/transactions?${searchParams}`);
  },

  get: (id: string) => request<ApiResponse<Transaction>>(`/transactions/${id}`),

  update: (id: string, data: Partial<Transaction>) =>
    request<ApiResponse<Transaction>>(`/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  categorize: (id: string, category_id: string) =>
    request<ApiResponse<Transaction>>(`/transactions/${id}/categorize`, {
      method: 'POST',
      body: JSON.stringify({ category_id }),
    }),

  bulkCategorize: (transaction_ids: string[], category_id: string) =>
    request<ApiResponse<{ updated: number }>>('/transactions/bulk-categorize', {
      method: 'POST',
      body: JSON.stringify({ transaction_ids, category_id }),
    }),
};

// ============ Categories API ============

export const categoriesApi = {
  list: () => request<ApiResponse<Category[]>>('/categories'),

  create: (data: Omit<Category, 'id' | 'created_at'>) =>
    request<ApiResponse<Category>>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Category>) =>
    request<ApiResponse<Category>>(`/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<ApiResponse<void>>(`/categories/${id}`, { method: 'DELETE' }),
};

// ============ Accounts API ============

export const accountsApi = {
  list: (params?: { plaid_environment?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.plaid_environment) {
      searchParams.set('plaid_environment', params.plaid_environment);
    }
    return request<ApiResponse<Account[]>>(`/accounts?${searchParams}`);
  },

  get: (id: string) => request<ApiResponse<Account>>(`/accounts/${id}`),

  sync: (id: string) =>
    request<ApiResponse<{ synced: boolean }>>(`/accounts/${id}/sync`, {
      method: 'POST',
    }),
};

// ============ Plaid Integration API ============

export const plaidApi = {
  createLinkToken: () =>
    request<ApiResponse<PlaidLinkToken>>('/plaid/link-token', {
      method: 'POST',
    }),

  exchangeToken: (public_token: string, institution_id: string) =>
    request<ApiResponse<PlaidConnection>>('/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({ public_token, institution_id }),
    }),

  getConnections: () =>
    request<ApiResponse<PlaidConnection[]>>('/plaid/connections'),

  syncTransactions: (connection_id: string) =>
    request<ApiResponse<PlaidSyncResult>>(`/plaid/connections/${connection_id}/sync`, {
      method: 'POST',
    }),

  removeConnection: (connection_id: string) =>
    request<ApiResponse<void>>(`/plaid/connections/${connection_id}`, {
      method: 'DELETE',
    }),
};

// ============ Budgets API ============

export const budgetsApi = {
  list: () => request<ApiResponse<Budget[]>>('/budgets'),

  create: (data: Omit<Budget, 'id' | 'created_at'>) =>
    request<ApiResponse<Budget>>('/budgets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Budget>) =>
    request<ApiResponse<Budget>>(`/budgets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<ApiResponse<void>>(`/budgets/${id}`, { method: 'DELETE' }),

  getProgress: (period?: string) =>
    request<ApiResponse<{ category_id: string; spent: number; budget: number }[]>>(
      `/budgets/progress${period ? `?period=${period}` : ''}`
    ),
};

// ============ Reports & Insights API ============

export const reportsApi = {
  getSpendingByCategory: (params: { start_date: string; end_date: string }) =>
    request<ApiResponse<SpendingInsight[]>>(
      `/reports/spending-by-category?start_date=${params.start_date}&end_date=${params.end_date}`
    ),

  getMonthlyOverview: (params: { year: number; month?: number }) =>
    request<ApiResponse<MonthlyOverview[]>>(
      `/reports/monthly-overview?year=${params.year}${params.month ? `&month=${params.month}` : ''}`
    ),

  getIncomeVsExpenses: (params: { start_date: string; end_date: string }) =>
    request<ApiResponse<{ date: string; income: number; expenses: number }[]>>(
      `/reports/income-vs-expenses?start_date=${params.start_date}&end_date=${params.end_date}`
    ),

  getCashFlow: (params: { start_date: string; end_date: string }) =>
    request<ApiResponse<{ date: string; amount: number; running_total: number }[]>>(
      `/reports/cash-flow?start_date=${params.start_date}&end_date=${params.end_date}`
    ),
};

export { ApiError };
