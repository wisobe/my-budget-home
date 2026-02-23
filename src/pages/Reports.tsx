import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { IncomeExpenseChart } from '@/components/reports/IncomeExpenseChart';
import { SavingsRateChart } from '@/components/reports/SavingsRateChart';
import { NetSavingsChart } from '@/components/reports/NetSavingsChart';
import { CategoryBreakdown } from '@/components/reports/CategoryBreakdown';
import { StatCard } from '@/components/dashboard/StatCard';
import { useMonthlyOverviewByRange } from '@/hooks/use-reports';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TrendingUp, Percent, DollarSign, Calendar } from 'lucide-react';

function ReportStats({ monthlyData }: { monthlyData: { total_income: number; total_expenses: number; net_savings: number; savings_rate: number }[] }) {
  const { t } = useTranslation();
  const yearlyIncome = monthlyData.reduce((sum, m) => sum + Number(m.total_income), 0);
  const yearlyExpenses = monthlyData.reduce((sum, m) => sum + Number(m.total_expenses), 0);
  const yearlySavings = monthlyData.reduce((sum, m) => sum + Number(m.net_savings), 0);
  const avgSavingsRate = monthlyData.length > 0
    ? monthlyData.reduce((sum, m) => sum + Number(m.savings_rate), 0) / monthlyData.length
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard title={t('reports.totalIncome')} value={yearlyIncome} icon={TrendingUp} variant="income" />
      <StatCard title={t('reports.totalExpenses')} value={yearlyExpenses} icon={DollarSign} variant="expense" />
      <StatCard title={t('reports.netSavings')} value={yearlySavings} icon={Calendar} variant={yearlySavings >= 0 ? 'income' : 'expense'} />
      <StatCard title={t('reports.avgSavingsRate')} value={`${avgSavingsRate.toFixed(1)}%`} icon={Percent} description={t('reports.monthlyAverage')} />
    </div>
  );
}

function ReportTab({ startDate, endDate, label }: { startDate: string; endDate: string; label: string }) {
  const { data } = useMonthlyOverviewByRange(startDate, endDate);
  const monthlyData = data?.data || [];

  return (
    <div className="space-y-6">
      <ReportStats monthlyData={monthlyData} />
      <div className="grid gap-6 lg:grid-cols-2">
        <IncomeExpenseChart startDate={startDate} endDate={endDate} label={label} />
        <SavingsRateChart startDate={startDate} endDate={endDate} />
      </div>
      <NetSavingsChart startDate={startDate} endDate={endDate} />
      <CategoryBreakdown startDate={startDate} endDate={endDate} />
    </div>
  );
}

const Reports = () => {
  const { t } = useTranslation();
  const today = new Date();
  const currentYear = today.getFullYear();
  const endDate = today.toISOString().split('T')[0];

  const ranges = useMemo(() => {
    const makeStart = (monthsBack: number) => {
      const d = new Date(today.getFullYear(), today.getMonth() - monthsBack, today.getDate() + 1);
      return d.toISOString().split('T')[0];
    };
    return {
      rolling12: makeStart(12),
      months6: makeStart(6),
      months3: makeStart(3),
      months1: makeStart(1),
      ytd: `${currentYear}-01-01`,
    };
  }, [currentYear]);

  const tabs = [
    { value: 'rolling', label: t('reports.rolling12'), startDate: ranges.rolling12 },
    { value: '6m', label: t('reports.last6Months'), startDate: ranges.months6 },
    { value: '3m', label: t('reports.last3Months'), startDate: ranges.months3 },
    { value: '1m', label: t('reports.lastMonth'), startDate: ranges.months1 },
    { value: 'ytd', label: t('reports.ytd', { year: currentYear }), startDate: ranges.ytd },
  ];

  return (
    <AppLayout title={t('reports.title')}>
      <Tabs defaultValue="rolling" className="space-y-6">
        <TabsList>
          {tabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>

        {tabs.map(tab => (
          <TabsContent key={tab.value} value={tab.value}>
            <ReportTab startDate={tab.startDate} endDate={endDate} label={tab.label} />
          </TabsContent>
        ))}
      </Tabs>
    </AppLayout>
  );
};

export default Reports;
