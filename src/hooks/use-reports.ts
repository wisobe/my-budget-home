import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';

export function useSpendingByCategory(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['spending-by-category', startDate, endDate],
    queryFn: () => reportsApi.getSpendingByCategory({ start_date: startDate, end_date: endDate }),
  });
}

export function useMonthlyOverview(year: number) {
  return useQuery({
    queryKey: ['monthly-overview', year],
    queryFn: () => reportsApi.getMonthlyOverview({ year }),
  });
}

export function useMonthlyOverviewByRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['monthly-overview-range', startDate, endDate],
    queryFn: () => reportsApi.getMonthlyOverviewByRange({ start_date: startDate, end_date: endDate }),
  });
}

export function useIncomeVsExpenses(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['income-vs-expenses', startDate, endDate],
    queryFn: () => reportsApi.getIncomeVsExpenses({ start_date: startDate, end_date: endDate }),
  });
}
