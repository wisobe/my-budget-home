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
  BudgetWithSpent,
  SpendingInsight,
  MonthlyOverview,
  ApiResponse,
  PaginatedResponse,
  PlaidLinkToken,
  PlaidSyncResult,
  AuthVerifyResponse,
  User,
  AuditLogEntry,
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
  const token = localStorage.getItem('auth_token');

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  const parseErrorMessage = async (fallback: string) => {
    try {
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) return fallback;
      const error = await response.json();
      return typeof error?.message === 'string' ? error.message : fallback;
    } catch {
      return fallback;
    }
  };

  if (response.status === 401) {
    if (!endpoint.includes('/auth/')) {
      localStorage.removeItem('auth_token');
      window.location.reload();
    }
    const message = await parseErrorMessage('Unauthorized');
    throw new ApiError(401, message);
  }

  if (!response.ok) {
    const message = await parseErrorMessage('Request failed');
    throw new ApiError(response.status, message);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new ApiError(500, 'Backend unavailable or API endpoint is misconfigured.');
  }

  try {
    return await response.json();
  } catch {
    throw new ApiError(500, 'Invalid API response received.');
  }
}

// ============ Auth API ============

export const authApi = {
  verify: () =>
    request<ApiResponse<AuthVerifyResponse>>('/auth/verify.php'),

  login: (email: string, password: string, deviceToken?: string) =>
    request<ApiResponse<{ token?: string; expires_at?: string; user?: User; requires_2fa?: boolean; temp_token?: string }>>('/auth/login.php', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...(deviceToken ? { device_token: deviceToken } : {}) }),
    }),

  verify2fa: (temp_token: string, code: string, trustDevice?: boolean) =>
    request<ApiResponse<{ token: string; expires_at: string; user: User; device_token?: string }>>('/auth/2fa-verify.php', {
      method: 'POST',
      body: JSON.stringify({ temp_token, code, ...(trustDevice ? { trust_device: true } : {}) }),
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

  createUser: (data: { email: string; name: string; password: string; role?: string; allow_sandbox?: boolean }) =>
    request<ApiResponse<User>>('/auth/users.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (data: { id: string; email?: string; name?: string; password?: string; role?: string; allow_sandbox?: boolean }) =>
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

  categorize: (transaction_id: string, category_id: string | null, plaid_environment?: string, learn_rule?: boolean) =>
    request<ApiResponse<Transaction>>('/transactions/categorize.php', {
      method: 'POST',
      body: JSON.stringify({ transaction_id, category_id, plaid_environment, learn_rule }),
    }),

  exclude: (transaction_id: string, excluded: boolean) =>
    request<ApiResponse<{ excluded: boolean }>>('/transactions/exclude.php', {
      method: 'POST',
      body: JSON.stringify({ transaction_id, excluded }),
    }),

  lock: (transaction_id: string, locked: boolean) =>
    request<ApiResponse<{ auto_categorize_locked: boolean }>>('/transactions/lock.php', {
      method: 'POST',
      body: JSON.stringify({ transaction_id, locked }),
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

  updateAmount: (transaction_id: string, amount: number) =>
    request<ApiResponse<Transaction>>('/transactions/update-amount.php', {
      method: 'POST',
      body: JSON.stringify({ transaction_id, amount }),
    }),

  resetAmount: (transaction_id: string) =>
    request<ApiResponse<Transaction>>('/transactions/update-amount.php', {
      method: 'POST',
      body: JSON.stringify({ transaction_id, reset: true }),
    }),

  backfillCurrency: (dry_run: boolean) =>
    request<ApiResponse<{
      dry_run: boolean;
      converted: number;
      skipped: number;
      total_candidates: number;
      preview: Array<{ id: string; name: string; date: string; currency: string; original_amount: number; cad_amount: number; rate: number }>;
    }>>('/transactions/backfill-currency.php', {
      method: 'POST',
      body: JSON.stringify({ dry_run }),
    }),

  importPreview: (data: CsvImportRequest) =>
    request<ApiResponse<CsvImportPreview>>('/transactions/import-preview.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  import: (data: CsvImportRequest) =>
    request<ApiResponse<CsvImportResult>>('/transactions/import.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export interface CsvImportRow {
  date?: string;
  name?: string;
  amount?: string;
  debit?: string;
  credit?: string;
  merchant_name?: string;
  notes?: string;
  currency?: string;
}

export interface CsvImportRequest {
  account_id: string;
  rows: CsvImportRow[];
  mapping: { date_format: string; sign_convention: 'positive_expense' | 'positive_income' };
  allow_duplicates?: boolean;
  plaid_environment?: string;
}

export interface CsvImportPreviewRow {
  row: number;
  date: string;
  name: string;
  merchant_name: string | null;
  amount: number;
  notes: string | null;
  currency: string | null;
}

export interface CsvImportPreview {
  account_id: string;
  total_rows: number;
  to_import: number;
  duplicates: number;
  invalid: number;
  preview: CsvImportPreviewRow[];
  duplicate_preview: CsvImportPreviewRow[];
  invalid_rows: Array<{ row: number; reason: string }>;
}

export interface CsvImportResult {
  imported: number;
  skipped_duplicates: number;
  invalid: number;
  auto_categorized: number;
  auto_excluded: number;
}


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

  listRules: (plaid_environment?: string) =>
    request<ApiResponse<CategoryRule[]>>(`/categories/rules.php${plaid_environment ? `?plaid_environment=${plaid_environment}` : ''}`),

  createRule: (data: { category_id: string; keyword: string; match_type?: string; priority?: number; apply_to_existing?: boolean; plaid_environment?: string }) =>
    request<ApiResponse<CategoryRule>>('/categories/rules.php', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRule: (data: { id: string; keyword?: string; category_id?: string; match_type?: string; priority?: number; apply_to_existing?: boolean; plaid_environment?: string }) =>
    request<ApiResponse<CategoryRule>>('/categories/rules.php', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteRule: (id: string, plaid_environment?: string) =>
    request<ApiResponse<void>>('/categories/rules.php', {
      method: 'DELETE',
      body: JSON.stringify({ id, plaid_environment }),
    }),

  applyAllRules: (plaid_environment?: string) =>
    request<ApiResponse<{ applied_count: number }>>('/categories/apply-all-rules.php', {
      method: 'POST',
      body: JSON.stringify({ plaid_environment }),
    }),

  previewApplyAllRules: (plaid_environment?: string) =>
    request<ApiResponse<{ transactions: Array<{
      id: string;
      name: string;
      merchant_name: string | null;
      amount: number;
      date: string;
      current_category_name: string | null;
      current_category_color: string | null;
      new_category_name: string;
      new_category_color: string;
    }>; total_count: number }>>('/categories/preview-apply-rules.php', {
      method: 'POST',
      body: JSON.stringify({ plaid_environment }),
    }),
};

// ============ Exclusion Rules API ============

export const exclusionRulesApi = {
  list: (plaid_environment?: string) =>
    request<ApiResponse<any[]>>(`/exclusion-rules/${plaid_environment ? `?plaid_environment=${plaid_environment}` : ''}`),

  create: (data: { keyword: string; match_type?: string; priority?: number; apply_to_existing?: boolean; plaid_environment?: string }) =>
    request<ApiResponse<any>>('/exclusion-rules/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (data: { id: string; keyword?: string; match_type?: string; priority?: number; apply_to_existing?: boolean; plaid_environment?: string }) =>
    request<ApiResponse<any>>('/exclusion-rules/', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string, plaid_environment?: string) =>
    request<ApiResponse<void>>('/exclusion-rules/', {
      method: 'DELETE',
      body: JSON.stringify({ id, plaid_environment }),
    }),

  previewApplyAll: (plaid_environment?: string) =>
    request<ApiResponse<{ transactions: Array<{
      id: string; name: string; merchant_name: string | null; amount: number; date: string;
    }>; total_count: number }>>('/exclusion-rules/preview-apply-all.php', {
      method: 'POST',
      body: JSON.stringify({ plaid_environment }),
    }),

  applyAll: (plaid_environment?: string) =>
    request<ApiResponse<{ applied_count: number }>>('/exclusion-rules/apply-all.php', {
      method: 'POST',
      body: JSON.stringify({ plaid_environment }),
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

  createManual: (data: {
    name: string;
    type: string;
    currency?: string;
    institution_name?: string;
    current_balance?: number;
  }) =>
    request<ApiResponse<Account>>('/accounts/create.php', {
      method: 'POST',
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

// ============ Budgets API ============

export const budgetsApi = {
  list: (plaid_environment?: string) =>
    request<ApiResponse<BudgetWithSpent[]>>(`/budgets/${plaid_environment ? `?plaid_environment=${plaid_environment}` : ''}`),

  create: (data: { category_id: string; amount: number; period: string; plaid_environment?: string }) =>
    request<ApiResponse<BudgetWithSpent>>('/budgets/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (data: { id: string; amount?: number; category_id?: string; period?: string; plaid_environment?: string }) =>
    request<ApiResponse<BudgetWithSpent>>('/budgets/', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string, plaid_environment?: string) =>
    request<ApiResponse<null>>('/budgets/', {
      method: 'DELETE',
      body: JSON.stringify({ id, plaid_environment }),
    }),

  history: (category_id: string, period: string, plaid_environment?: string) =>
    request<ApiResponse<{ month: string; spent: number }[]>>(
      `/budgets/history.php?category_id=${category_id}&period=${period}${plaid_environment ? `&plaid_environment=${plaid_environment}` : ''}`
    ),
};

// ============ User Preferences API ============

export const preferencesApi = {
  get: () =>
    request<ApiResponse<Record<string, string>>>('/settings/user-preferences.php'),

  save: (prefs: Record<string, string>) =>
    request<ApiResponse<{ saved: boolean }>>('/settings/user-preferences.php', {
      method: 'POST',
      body: JSON.stringify(prefs),
    }),
};

// ============ Audit Log API ============

export const auditApi = {
  list: (params?: {
    page?: number;
    per_page?: number;
    event_type?: string;
    user_id?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.set(key, String(value));
      });
    }
    return request<PaginatedResponse<AuditLogEntry>>(`/audit/?${searchParams}`);
  },
  securityStats: () => request<ApiResponse<{
    status: 'healthy' | 'warning' | 'critical';
    alerts: string[];
    failed_logins: { last_24h: number; last_7d: number; last_30d: number };
    successful_logins: { last_24h: number; last_7d: number; last_30d: number };
    suspicious_ips: { ip_address: string; failure_count: number }[];
    targeted_accounts: { email: string; failure_count: number }[];
    security_events: Record<string, number>;
  }>>(`/audit/security-stats.php`),
  activeSessions: () => request<ApiResponse<{
    user_id: string;
    name: string;
    email: string;
    role: string;
    session_started: string;
    expires_at: string;
    last_ip: string | null;
    last_login: string | null;
  }[]>>(`/audit/active-sessions.php`),
  forceLogout: (user_id: string) =>
    request<ApiResponse<{ revoked: number }>>(`/audit/force-logout.php`, {
      method: 'POST',
      body: JSON.stringify({ user_id }),
    }),
};

// ============ Subscriptions API ============

export const subscriptionsApi = {
  list: (plaid_environment?: string, overrides?: Record<string, number>) => {
    const sp = new URLSearchParams();
    if (plaid_environment) sp.set('plaid_environment', plaid_environment);
    if (overrides && Object.keys(overrides).length) sp.set('overrides', JSON.stringify(overrides));
    return request<ApiResponse<any>>(`/subscriptions/?${sp}`);
  },
  dismiss: (merchant_key: string, dismiss: boolean, plaid_environment?: string) =>
    request<ApiResponse<any>>(`/subscriptions/${plaid_environment ? `?plaid_environment=${plaid_environment}` : ''}`, {
      method: 'POST',
      body: JSON.stringify({ merchant_key, dismiss }),
    }),
  getTuning: () =>
    request<ApiResponse<{ params: Record<string, number>; defaults: Record<string, number> }>>('/subscriptions/tuning.php'),
  saveTuning: (params: Record<string, number>) =>
    request<ApiResponse<{ saved: boolean; params: Record<string, number> }>>('/subscriptions/tuning.php', {
      method: 'POST',
      body: JSON.stringify({ params }),
    }),
  resetTuning: () =>
    request<ApiResponse<{ reset: boolean; params: Record<string, number> }>>('/subscriptions/tuning.php', {
      method: 'POST',
      body: JSON.stringify({ reset: true }),
    }),
  debug: (search: string, plaid_environment?: string, overrides?: Record<string, number>) => {
    const sp = new URLSearchParams({ search });
    if (plaid_environment) sp.set('plaid_environment', plaid_environment);
    if (overrides && Object.keys(overrides).length) sp.set('overrides', JSON.stringify(overrides));
    return request<ApiResponse<{
      search: string;
      plaid_environment: string;
      tuning_used: Record<string, number>;
      total_found: number;
      eligible_count: number;
      transactions: Array<{
        txn_id: string; name: string; merchant_name: string | null;
        amount: number; date: string; pending: number; excluded: number;
        category_name: string | null; filter_reasons: string[];
      }>;
      normalized_keys: Record<string, string>;
      interval_stats: { intervals: number[]; median: number; min: number; max: number } | null;
      amount_stats: { mean: number; std_dev: number; cv_percent: number } | null;
      matched_bucket: { label: string; days: number; min: number; max: number } | null;
      checks: Array<{ name: string; pass: boolean; detail: string }>;
      would_detect: boolean;
    }>>(`/subscriptions/debug.php?${sp}`);
  },
};

// ============ Insights API ============

export const insightsApi = {
  list: (plaid_environment?: string) =>
    request<ApiResponse<any[]>>(`/insights/${plaid_environment ? `?plaid_environment=${plaid_environment}` : ''}`),
};

// ============ Health Score API ============

export const healthScoreApi = {
  get: (plaid_environment?: string) =>
    request<ApiResponse<any>>(`/health-score/${plaid_environment ? `?plaid_environment=${plaid_environment}` : ''}`),
};

export { ApiError };
