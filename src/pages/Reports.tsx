import { AppLayout } from '@/components/layout/AppLayout';
import { IncomeExpenseChart } from '@/components/reports/IncomeExpenseChart';
import { SavingsRateChart } from '@/components/reports/SavingsRateChart';
import { CategoryBreakdown } from '@/components/reports/CategoryBreakdown';
import { StatCard } from '@/components/dashboard/StatCard';
import { useMonthlyOverview } from '@/hooks/use-reports';
import { TrendingUp, Percent, DollarSign, Calendar } from 'lucide-react';

const Reports = () => {
  const currentYear = new Date().getFullYear();
  const { data: overviewData } = useMonthlyOverview(currentYear);
  
  const monthlyData = overviewData?.data || [];
  
  // Calculate yearly totals
  const yearlyIncome = monthlyData.reduce((sum, m) => sum + m.total_income, 0);
  const yearlyExpenses = monthlyData.reduce((sum, m) => sum + m.total_expenses, 0);
  const yearlySavings = monthlyData.reduce((sum, m) => sum + m.net_savings, 0);
  const avgSavingsRate = monthlyData.length > 0 
    ? monthlyData.reduce((sum, m) => sum + m.savings_rate, 0) / monthlyData.length 
    : 0;

  return (
    <AppLayout title="Reports & Insights">
      <div className="space-y-6">
        {/* Year-to-date Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="YTD Income"
            value={yearlyIncome}
            icon={TrendingUp}
            variant="income"
            description={`${currentYear} total`}
          />
          <StatCard
            title="YTD Expenses"
            value={yearlyExpenses}
            icon={DollarSign}
            variant="expense"
            description={`${currentYear} total`}
          />
          <StatCard
            title="YTD Savings"
            value={yearlySavings}
            icon={Calendar}
            variant={yearlySavings >= 0 ? 'income' : 'expense'}
            description={`${currentYear} total`}
          />
          <StatCard
            title="Avg Savings Rate"
            value={`${avgSavingsRate.toFixed(1)}%`}
            icon={Percent}
            description="Monthly average"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <IncomeExpenseChart />
          <SavingsRateChart />
        </div>

        {/* Category Breakdown */}
        <CategoryBreakdown />
      </div>
    </AppLayout>
  );
};

export default Reports;
