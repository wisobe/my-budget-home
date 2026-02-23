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
  User,
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

  login: (email: string, password: string) =>
    request<ApiResponse<{ token?: string; expires_at?: string; user?: User; requires_2fa?: boolean; temp_token?: string }>>('/auth/login.php', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  verify2fa: (temp_token: string, code: string) =>
    request<ApiResponse<{ token: string; expires_at: string; user: User }>>('/auth/2fa-verify.php', {
      method: 'POST',
      body: JSON.stringify({ temp_token, code }),
    }),

  get2faStatus: () =>
    request<ApiResponse<{ totp_enabled: boolean }>>('/auth/2fa-setup.php'),

  setup2fa: (action: 'generate' | 'confirm' | 'disable', code?: string) =>
    request<ApiResponse<{
      otpauth_uri?: string;
      secret?: string;
      recovery_codes?: string[];
      totp_enabled?: boolean;
    }>>('/auth/2fa-setup.php', {
      method: 'POST',
      body: JSON.stringify({ action, code }),
    }),

  changePassword: (current_password: string, new_password: string) =>
    request<ApiResponse<null>>('/auth/change-password.php', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    }),

  // Admin: user management
  listUsers: () =>
    request<ApiResponse<User[]>>('/auth/users.php'),

  createUser: (data: { email: string; name: string; password: string; role?: string }) =>
    request<ApiResponse<User>>('/auth/users.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (data: { id: string; email?: string; name?: string; password?: string; role?: string }) =>
    request<ApiResponse<User>>('/auth/users.php', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteUser: (id: string) =>
    request<ApiResponse<null>>('/auth/users.php', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
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

  update: (data: { id: string; name?: string; color?: string; parent_id?: string | null; is_income?: boolean }) =>
    request<ApiResponse<Category>>('/categories/', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<ApiResponse<void>>('/categories/delete.php', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),

  listRules: () => request<ApiResponse<CategoryRule[]>>('/categories/rules.php'),

  createRule: (data: { category_id: string; keyword: string; match_type?: string; priority?: number; apply_to_existing?: boolean }) =>
    request<ApiResponse<CategoryRule>>('/categories/rules.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRule: (data: { id: string; keyword?: string; category_id?: string; match_type?: string; priority?: number; apply_to_existing?: boolean }) =>
    request<ApiResponse<CategoryRule>>('/categories/rules.php', {
      method: 'PUT',
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

  update: (data: { id: string; excluded?: boolean }) =>
    request<ApiResponse<Account>>('/accounts/', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
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
