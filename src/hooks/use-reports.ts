import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';

export function useSpendingByCategory(startDate: string, endDate: string) {
  const { plaidEnvironment } = usePlaidEnvironment();
  return useQuery({
    queryKey: ['spending-by-category', startDate, endDate, plaidEnvironment],
    queryFn: () => reportsApi.getSpendingByCategory({ start_date: startDate, end_date: endDate, plaid_environment: plaidEnvironment }),
  });
}

export function useMonthlyOverview(year: number) {
  const { plaidEnvironment } = usePlaidEnvironment();
  return useQuery({
    queryKey: ['monthly-overview', year, plaidEnvironment],
    queryFn: () => reportsApi.getMonthlyOverview({ year, plaid_environment: plaidEnvironment }),
  });
}

export function useMonthlyOverviewByRange(startDate: string, endDate: string) {
  const { plaidEnvironment } = usePlaidEnvironment();
  return useQuery({
    queryKey: ['monthly-overview-range', startDate, endDate, plaidEnvironment],
    queryFn: () => reportsApi.getMonthlyOverviewByRange({ start_date: startDate, end_date: endDate, plaid_environment: plaidEnvironment }),
  });
}

export function useIncomeVsExpenses(startDate: string, endDate: string) {
  const { plaidEnvironment } = usePlaidEnvironment();
  return useQuery({
    queryKey: ['income-vs-expenses', startDate, endDate, plaidEnvironment],
    queryFn: () => reportsApi.getIncomeVsExpenses({ start_date: startDate, end_date: endDate }),
  });
}
