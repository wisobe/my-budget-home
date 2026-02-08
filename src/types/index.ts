// Core types for the budgeting application

export interface Transaction {
  id: string;
  plaid_transaction_id?: string;
  account_id: string;
  date: string;
  name: string;
  merchant_name?: string;
  amount: number; // Positive = expense, Negative = income
  category_id?: string;
  pending: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  parent_id?: string;
  is_income: boolean;
  created_at: string;
}

export interface Account {
  id: string;
  plaid_account_id?: string;
  name: string;
  official_name?: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'other';
  subtype?: string;
  current_balance: number;
  available_balance?: number;
  currency: string;
  institution_name?: string;
  last_synced?: string;
  created_at: string;
}

export interface PlaidConnection {
  id: string;
  institution_id: string;
  institution_name: string;
  access_token_encrypted?: string; // Backend only
  plaid_environment?: 'sandbox' | 'production';
  last_synced?: string;
  status: 'active' | 'error' | 'pending';
  error_message?: string;
  created_at: string;
}

export interface Budget {
  id: string;
  category_id: string;
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  created_at: string;
}

export interface SpendingInsight {
  category_id: string;
  category_name: string;
  total_amount: number;
  transaction_count: number;
  percentage_of_total: number;
  trend: 'up' | 'down' | 'stable';
  trend_percentage?: number;
}

export interface MonthlyOverview {
  month: string;
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Plaid-specific types
export interface PlaidLinkToken {
  link_token: string;
  expiration: string;
}

export interface PlaidSyncResult {
  added: number;
  modified: number;
  removed: number;
  accounts_updated: number;
}
