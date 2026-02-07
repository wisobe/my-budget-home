import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
import { mockSpendingInsights, mockMonthlyOverview } from '@/lib/mock-data';
import { useMockDataSetting } from '@/contexts/MockDataContext';

export function useSpendingByCategory(startDate: string, endDate: string) {
  const { useMockData } = useMockDataSetting();
  return useQuery({
    queryKey: ['spending-by-category', startDate, endDate, useMockData],
    queryFn: async () => {
      if (useMockData) {
        return { data: mockSpendingInsights, success: true };
      }
      return reportsApi.getSpendingByCategory({ start_date: startDate, end_date: endDate });
    },
  });
}

export function useMonthlyOverview(year: number) {
  const { useMockData } = useMockDataSetting();
  return useQuery({
    queryKey: ['monthly-overview', year, useMockData],
    queryFn: async () => {
      if (useMockData) {
        return { data: mockMonthlyOverview, success: true };
      }
      return reportsApi.getMonthlyOverview({ year });
    },
  });
}

export function useIncomeVsExpenses(startDate: string, endDate: string) {
  const { useMockData } = useMockDataSetting();
  return useQuery({
    queryKey: ['income-vs-expenses', startDate, endDate, useMockData],
    queryFn: async () => {
      if (useMockData) {
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
