import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
import { mockSpendingInsights, mockMonthlyOverview } from '@/lib/mock-data';

// Set to true to use mock data during development
const USE_MOCK_DATA = true;

export function useSpendingByCategory(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['spending-by-category', startDate, endDate],
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        return { data: mockSpendingInsights, success: true };
      }
      return reportsApi.getSpendingByCategory({ start_date: startDate, end_date: endDate });
    },
  });
}

export function useMonthlyOverview(year: number) {
  return useQuery({
    queryKey: ['monthly-overview', year],
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        return { data: mockMonthlyOverview, success: true };
      }
      return reportsApi.getMonthlyOverview({ year });
    },
  });
}

export function useIncomeVsExpenses(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['income-vs-expenses', startDate, endDate],
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        // Generate mock data
        const data = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
          data.push({
            date: d.toISOString().slice(0, 7),
            income: 3000 + Math.random() * 1000,
            expenses: 2000 + Math.random() * 1500,
          });
        }
        return { data, success: true };
      }
      return reportsApi.getIncomeVsExpenses({ start_date: startDate, end_date: endDate });
    },
  });
}
