/**
 * API Client for the Budgeting App Backend
 */

import type {
  Transaction,
  TransactionSplit,
  Category,
  CategoryRule,
  Account,
  PlaidConnection,
  Budget,
  SpendingInsight,
  MonthlyOverview,
  ApiResponse,
  PaginatedResponse,
  PlaidLinkToken,
  PlaidSyncResult,
  AuthVerifyResponse,
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
  const token = sessionStorage.getItem('auth_token');

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  if (response.status === 401) {
    // Only clear token and reload if this is NOT an auth endpoint
    if (!endpoint.includes('/auth/')) {
      sessionStorage.removeItem('auth_token');
      window.location.reload();
    }
    const error = await response.json().catch(() => ({ message: 'Unauthorized' }));
    throw new ApiError(401, error.message || 'Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(response.status, error.message || 'Request failed');
  }

  return response.json();
}

// ============ Auth API ============

export const authApi = {
  verify: () =>
    request<ApiResponse<AuthVerifyResponse>>('/auth/verify.php'),

  login: (password: string) =>
    request<ApiResponse<{ token: string; expires_at: string }>>('/auth/login.php', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  changePassword: (current_password: string, new_password: string) =>
    request<ApiResponse<null>>('/auth/change-password.php', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    }),
};

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
    show_excluded?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'show_excluded') {
            searchParams.set(key, value ? '1' : '0');
          } else {
            searchParams.set(key, String(value));
          }
        }
      });
    }
    return request<PaginatedResponse<Transaction>>(`/transactions/?${searchParams}`);
  },

  get: (id: string) => request<ApiResponse<Transaction>>(`/transactions/?id=${id}`),

  categorize: (transaction_id: string, category_id: string | null) =>
    request<ApiResponse<Transaction>>('/transactions/categorize.php', {
      method: 'POST',
      body: JSON.stringify({ transaction_id, category_id }),
    }),

  exclude: (transaction_id: string, excluded: boolean) =>
    request<ApiResponse<{ excluded: boolean }>>('/transactions/exclude.php', {
      method: 'POST',
      body: JSON.stringify({ transaction_id, excluded }),
    }),

  create: (data: {
    account_id: string;
    date: string;
    name: string;
    amount: number;
    category_id?: string;
    merchant_name?: string;
    notes?: string;
  }) =>
    request<ApiResponse<Transaction>>('/transactions/create.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSplits: (transaction_id: string) =>
    request<ApiResponse<TransactionSplit[]>>(`/transactions/splits.php?transaction_id=${transaction_id}`),

  saveSplits: (transaction_id: string, splits: { category_id?: string; amount: number; is_excluded?: boolean }[]) =>
    request<ApiResponse<TransactionSplit[]>>('/transactions/splits.php', {
      method: 'POST',
      body: JSON.stringify({ transaction_id, splits }),
    }),

  deleteSplits: (transaction_id: string) =>
    request<ApiResponse<null>>('/transactions/splits.php', {
      method: 'DELETE',
      body: JSON.stringify({ transaction_id }),
    }),
};

// ============ Categories API ============

export const categoriesApi = {
  list: () => request<ApiResponse<Category[]>>('/categories/'),

  create: (data: Omit<Category, 'id' | 'created_at'>) =>
    request<ApiResponse<Category>>('/categories/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<ApiResponse<void>>('/categories/delete.php', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),

  listRules: () => request<ApiResponse<CategoryRule[]>>('/categories/rules.php'),

  createRule: (data: { category_id: string; keyword: string; match_type?: string; priority?: number }) =>
    request<ApiResponse<CategoryRule>>('/categories/rules.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteRule: (id: string) =>
    request<ApiResponse<void>>('/categories/rules.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    }),
};

// ============ Accounts API ============

export const accountsApi = {
  list: (params?: { plaid_environment?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.plaid_environment) {
      searchParams.set('plaid_environment', params.plaid_environment);
    }
    return request<ApiResponse<Account[]>>(`/accounts/?${searchParams}`);
  },

  get: (id: string) => request<ApiResponse<Account>>(`/accounts/${id}`),
};

// ============ Plaid Integration API ============

export const plaidApi = {
  createLinkToken: () =>
    request<ApiResponse<PlaidLinkToken>>('/plaid/link-token.php', {
      method: 'POST',
    }),

  exchangeToken: (public_token: string, institution_id: string) =>
    request<ApiResponse<PlaidConnection>>('/plaid/exchange-token.php', {
      method: 'POST',
      body: JSON.stringify({ public_token, institution_id }),
    }),

  getConnections: () =>
    request<ApiResponse<PlaidConnection[]>>('/plaid/connections.php'),

  syncTransactions: (connection_id: string) =>
    request<ApiResponse<PlaidSyncResult>>('/plaid/sync.php', {
      method: 'POST',
      body: JSON.stringify({ connection_id }),
    }),

  removeConnection: (connection_id: string) =>
    request<ApiResponse<void>>('/plaid/remove.php', {
      method: 'POST',
      body: JSON.stringify({ connection_id }),
    }),
};

// ============ Reports & Insights API ============

export const reportsApi = {
  getSpendingByCategory: (params: { start_date: string; end_date: string; plaid_environment?: string }) =>
    request<ApiResponse<SpendingInsight[]>>(
      `/reports/spending-by-category.php?start_date=${params.start_date}&end_date=${params.end_date}${params.plaid_environment ? `&plaid_environment=${params.plaid_environment}` : ''}`
    ),

  getMonthlyOverview: (params: { year: number; month?: number; plaid_environment?: string }) =>
    request<ApiResponse<MonthlyOverview[]>>(
      `/reports/monthly-overview.php?year=${params.year}${params.month ? `&month=${params.month}` : ''}${params.plaid_environment ? `&plaid_environment=${params.plaid_environment}` : ''}`
    ),

  getMonthlyOverviewByRange: (params: { start_date: string; end_date: string; plaid_environment?: string }) =>
    request<ApiResponse<MonthlyOverview[]>>(
      `/reports/monthly-overview.php?start_date=${params.start_date}&end_date=${params.end_date}${params.plaid_environment ? `&plaid_environment=${params.plaid_environment}` : ''}`
    ),

  getIncomeVsExpenses: (params: { start_date: string; end_date: string }) =>
    request<ApiResponse<{ date: string; income: number; expenses: number }[]>>(
      `/reports/income-vs-expenses.php?start_date=${params.start_date}&end_date=${params.end_date}`
    ),

  getCashFlow: (params: { start_date: string; end_date: string }) =>
    request<ApiResponse<{ date: string; amount: number; running_total: number }[]>>(
      `/reports/cash-flow.php?start_date=${params.start_date}&end_date=${params.end_date}`
    ),
};

export { ApiError };
