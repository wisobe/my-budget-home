import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { IncomeExpenseChart } from '@/components/reports/IncomeExpenseChart';
import { SavingsRateChart } from '@/components/reports/SavingsRateChart';
import { NetSavingsChart } from '@/components/reports/NetSavingsChart';
import { CategoryBreakdown } from '@/components/reports/CategoryBreakdown';
import { StatCard } from '@/components/dashboard/StatCard';
import { useMonthlyOverviewByRange } from '@/hooks/use-reports';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Percent, DollarSign, Calendar } from 'lucide-react';
import { usePreferences } from '@/contexts/PreferencesContext';
import { ConsentGate } from '@/components/consent/ConsentGate';

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
  const { t, i18n } = useTranslation();
  const { consentDataProcessing } = usePreferences();
  const today = new Date();
  const currentYear = today.getFullYear();
  const endDate = today.toISOString().split('T')[0];
  const locale = i18n.language === 'fr' ? fr : enUS;

  // Generate last 12 months for the month picker
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string; startDate: string; endDate: string }[] = [];
    for (let i = 0; i < 13; i++) {
      const monthDate = subMonths(today, i);
      const start = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const end = format(endOfMonth(monthDate), 'yyyy-MM-dd');
      const label = format(monthDate, 'MMMM yyyy', { locale });
      options.push({ value: `month-${i}`, label, startDate: start, endDate: end });
    }
    return options;
  }, [currentYear, i18n.language]);

  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const selectedMonthData = monthOptions.find(m => m.value === selectedMonth) || monthOptions[0];

  const ranges = useMemo(() => {
    const calendarStart = (monthsBack: number) => {
      const d = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1);
      return d.toISOString().split('T')[0];
    };
    const lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    const calendarEnd = lastDayPrevMonth.toISOString().split('T')[0];
    const currentMonthStart = format(startOfMonth(today), 'yyyy-MM-dd');

    return {
      rolling12Start: calendarStart(12),
      months6Start: calendarStart(6),
      months3Start: calendarStart(3),
      months1Start: calendarStart(1),
      calendarEnd,
      ytd: `${currentYear}-01-01`,
      currentMonthStart,
    };
  }, [currentYear]);

  const tabs = [
    { value: 'rolling', label: t('reports.rolling12'), startDate: ranges.rolling12Start, endDate: ranges.calendarEnd },
    { value: 'ytd', label: t('reports.ytd', { year: currentYear }), startDate: ranges.ytd, endDate: ranges.calendarEnd },
    { value: '6m', label: t('reports.last6Months'), startDate: ranges.months6Start, endDate: ranges.calendarEnd },
    { value: '3m', label: t('reports.last3Months'), startDate: ranges.months3Start, endDate: ranges.calendarEnd },
    { value: '1m', label: t('reports.lastMonth'), startDate: ranges.months1Start, endDate: ranges.calendarEnd },
    { value: 'current', label: t('reports.currentMonth'), startDate: ranges.currentMonthStart, endDate },
  ];

  if (!consentDataProcessing) {
    return (
      <AppLayout title={t('reports.title')}>
        <ConsentGate type="processing" />
      </AppLayout>
    );
  }

  return (
    <AppLayout title={t('reports.title')}>
      <Tabs defaultValue="rolling" className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <TabsList>
            {tabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
            ))}
            <TabsTrigger value="specific">{t('reports.specificMonth')}</TabsTrigger>
          </TabsList>
        </div>

        {tabs.map(tab => (
          <TabsContent key={tab.value} value={tab.value}>
            <ReportTab startDate={tab.startDate} endDate={tab.endDate} label={tab.label} />
          </TabsContent>
        ))}

        <TabsContent value="specific">
          <div className="mb-6">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ReportTab
            startDate={selectedMonthData.startDate}
            endDate={selectedMonthData.endDate}
            label={selectedMonthData.label}
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Reports;
