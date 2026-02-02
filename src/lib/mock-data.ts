/**
 * Mock data for development and demonstration purposes.
 * Remove or disable this when connecting to your real backend.
 */

import type { Transaction, Category, Account, SpendingInsight, MonthlyOverview } from '@/types';

export const mockCategories: Category[] = [
  { id: '1', name: 'Groceries', color: '#22c55e', is_income: false, created_at: '2024-01-01' },
  { id: '2', name: 'Restaurants', color: '#f97316', is_income: false, created_at: '2024-01-01' },
  { id: '3', name: 'Transportation', color: '#3b82f6', is_income: false, created_at: '2024-01-01' },
  { id: '4', name: 'Utilities', color: '#8b5cf6', is_income: false, created_at: '2024-01-01' },
  { id: '5', name: 'Entertainment', color: '#ec4899', is_income: false, created_at: '2024-01-01' },
  { id: '6', name: 'Shopping', color: '#14b8a6', is_income: false, created_at: '2024-01-01' },
  { id: '7', name: 'Healthcare', color: '#ef4444', is_income: false, created_at: '2024-01-01' },
  { id: '8', name: 'Salary', color: '#10b981', is_income: true, created_at: '2024-01-01' },
  { id: '9', name: 'Investments', color: '#6366f1', is_income: true, created_at: '2024-01-01' },
  { id: '10', name: 'Other Income', color: '#84cc16', is_income: true, created_at: '2024-01-01' },
];

export const mockAccounts: Account[] = [
  {
    id: '1',
    name: 'Desjardins Chequing',
    official_name: 'Compte Chèques',
    type: 'checking',
    current_balance: 3245.67,
    available_balance: 3200.00,
    currency: 'CAD',
    institution_name: 'Desjardins',
    last_synced: new Date().toISOString(),
    created_at: '2024-01-01',
  },
  {
    id: '2',
    name: 'Desjardins Savings',
    official_name: 'Compte Épargne',
    type: 'savings',
    current_balance: 15420.00,
    currency: 'CAD',
    institution_name: 'Desjardins',
    last_synced: new Date().toISOString(),
    created_at: '2024-01-01',
  },
  {
    id: '3',
    name: 'Desjardins Visa',
    official_name: 'Visa Desjardins',
    type: 'credit',
    current_balance: -1234.56,
    currency: 'CAD',
    institution_name: 'Desjardins',
    last_synced: new Date().toISOString(),
    created_at: '2024-01-01',
  },
];

// Generate realistic transactions
function generateTransactions(count: number): Transaction[] {
  const merchants = [
    { name: 'Metro', category: '1' },
    { name: 'IGA', category: '1' },
    { name: 'Maxi', category: '1' },
    { name: 'Tim Hortons', category: '2' },
    { name: 'McDonalds', category: '2' },
    { name: 'St-Hubert', category: '2' },
    { name: 'Shell', category: '3' },
    { name: 'Petro-Canada', category: '3' },
    { name: 'STM', category: '3' },
    { name: 'Hydro-Québec', category: '4' },
    { name: 'Bell', category: '4' },
    { name: 'Netflix', category: '5' },
    { name: 'Spotify', category: '5' },
    { name: 'Amazon', category: '6' },
    { name: 'Walmart', category: '6' },
    { name: 'Jean Coutu', category: '7' },
  ];

  const transactions: Transaction[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const merchant = merchants[Math.floor(Math.random() * merchants.length)];
    const daysAgo = Math.floor(Math.random() * 90);
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);

    transactions.push({
      id: `txn-${i}`,
      account_id: mockAccounts[Math.floor(Math.random() * 2)].id,
      date: date.toISOString().split('T')[0],
      name: merchant.name,
      merchant_name: merchant.name,
      amount: Math.round((Math.random() * 150 + 5) * 100) / 100,
      category_id: merchant.category,
      pending: Math.random() < 0.1,
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
    });
  }

  // Add some income transactions
  for (let i = 0; i < 6; i++) {
    const date = new Date(now);
    date.setDate(15);
    date.setMonth(date.getMonth() - i);

    transactions.push({
      id: `income-${i}`,
      account_id: '1',
      date: date.toISOString().split('T')[0],
      name: 'Direct Deposit - Salary',
      amount: -3500.00,
      category_id: '8',
      pending: false,
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
    });
  }

  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export const mockTransactions = generateTransactions(100);

export const mockSpendingInsights: SpendingInsight[] = [
  { category_id: '1', category_name: 'Groceries', total_amount: 542.30, transaction_count: 12, percentage_of_total: 28, trend: 'stable' },
  { category_id: '2', category_name: 'Restaurants', total_amount: 234.50, transaction_count: 8, percentage_of_total: 12, trend: 'up', trend_percentage: 15 },
  { category_id: '3', category_name: 'Transportation', total_amount: 189.00, transaction_count: 6, percentage_of_total: 10, trend: 'down', trend_percentage: -8 },
  { category_id: '4', category_name: 'Utilities', total_amount: 312.45, transaction_count: 4, percentage_of_total: 16, trend: 'stable' },
  { category_id: '5', category_name: 'Entertainment', total_amount: 156.99, transaction_count: 5, percentage_of_total: 8, trend: 'up', trend_percentage: 22 },
  { category_id: '6', category_name: 'Shopping', total_amount: 423.12, transaction_count: 7, percentage_of_total: 22, trend: 'down', trend_percentage: -12 },
  { category_id: '7', category_name: 'Healthcare', total_amount: 78.50, transaction_count: 2, percentage_of_total: 4, trend: 'stable' },
];

export const mockMonthlyOverview: MonthlyOverview[] = [
  { month: '2024-01', total_income: 3500, total_expenses: 2890, net_savings: 610, savings_rate: 17.4 },
  { month: '2024-02', total_income: 3500, total_expenses: 2650, net_savings: 850, savings_rate: 24.3 },
  { month: '2024-03', total_income: 3750, total_expenses: 2920, net_savings: 830, savings_rate: 22.1 },
  { month: '2024-04', total_income: 3500, total_expenses: 3100, net_savings: 400, savings_rate: 11.4 },
  { month: '2024-05', total_income: 3500, total_expenses: 2780, net_savings: 720, savings_rate: 20.6 },
  { month: '2024-06', total_income: 4000, total_expenses: 2950, net_savings: 1050, savings_rate: 26.3 },
];
