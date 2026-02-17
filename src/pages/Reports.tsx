import { AppLayout } from '@/components/layout/AppLayout';
import { IncomeExpenseChart } from '@/components/reports/IncomeExpenseChart';
import { SavingsRateChart } from '@/components/reports/SavingsRateChart';
import { CategoryBreakdown } from '@/components/reports/CategoryBreakdown';
import { StatCard } from '@/components/dashboard/StatCard';
import { useMonthlyOverview, useMonthlyOverviewByRange } from '@/hooks/use-reports';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TrendingUp, Percent, DollarSign, Calendar } from 'lucide-react';

function ReportStats({ monthlyData }: { monthlyData: { total_income: number; total_expenses: number; net_savings: number; savings_rate: number }[] }) {
  const yearlyIncome = monthlyData.reduce((sum, m) => sum + Number(m.total_income), 0);
  const yearlyExpenses = monthlyData.reduce((sum, m) => sum + Number(m.total_expenses), 0);
  const yearlySavings = monthlyData.reduce((sum, m) => sum + Number(m.net_savings), 0);
  const avgSavingsRate = monthlyData.length > 0
    ? monthlyData.reduce((sum, m) => sum + Number(m.savings_rate), 0) / monthlyData.length
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Total Income" value={yearlyIncome} icon={TrendingUp} variant="income" />
      <StatCard title="Total Expenses" value={yearlyExpenses} icon={DollarSign} variant="expense" />
      <StatCard title="Net Savings" value={yearlySavings} icon={Calendar} variant={yearlySavings >= 0 ? 'income' : 'expense'} />
      <StatCard title="Avg Savings Rate" value={`${avgSavingsRate.toFixed(1)}%`} icon={Percent} description="Monthly average" />
    </div>
  );
}

const Reports = () => {
  const currentYear = new Date().getFullYear();
  const today = new Date();
  const rolling12Start = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1)
    .toISOString().split('T')[0];
  const rolling12End = today.toISOString().split('T')[0];
  const ytdStart = `${currentYear}-01-01`;

  const { data: ytdData } = useMonthlyOverview(currentYear);
  const { data: rollingData } = useMonthlyOverviewByRange(rolling12Start, rolling12End);

  const ytdMonthly = ytdData?.data || [];
  const rollingMonthly = rollingData?.data || [];

  return (
    <AppLayout title="Reports & Insights">
      <Tabs defaultValue="rolling" className="space-y-6">
        <TabsList>
          <TabsTrigger value="rolling">Rolling 12 Months</TabsTrigger>
          <TabsTrigger value="ytd">Year to Date ({currentYear})</TabsTrigger>
        </TabsList>

        <TabsContent value="rolling" className="space-y-6">
          <ReportStats monthlyData={rollingMonthly} />
          <div className="grid gap-6 lg:grid-cols-2">
            <IncomeExpenseChart mode="rolling" />
            <SavingsRateChart mode="rolling" />
          </div>
          <CategoryBreakdown startDate={rolling12Start} endDate={rolling12End} />
        </TabsContent>

        <TabsContent value="ytd" className="space-y-6">
          <ReportStats monthlyData={ytdMonthly} />
          <div className="grid gap-6 lg:grid-cols-2">
            <IncomeExpenseChart mode="ytd" />
            <SavingsRateChart mode="ytd" />
          </div>
          <CategoryBreakdown startDate={ytdStart} endDate={rolling12End} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Reports;
