import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { format, startOfMonth } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { AccountsList } from '@/components/dashboard/AccountsList';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { SpendingChart } from '@/components/dashboard/SpendingChart';
import { BalanceAccountsPicker } from '@/components/dashboard/BalanceAccountsPicker';
import { useTotalBalance } from '@/hooks/use-accounts';
import { useMonthlyOverviewByRange } from '@/hooks/use-reports';
import { SyncButton } from '@/components/transactions/SyncButton';
import { useSyncAllConnections } from '@/hooks/use-plaid';
import { usePreferences } from '@/contexts/PreferencesContext';
import { ConsentGate } from '@/components/consent/ConsentGate';
import { Wallet, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';

const Dashboard = () => {
  const { t } = useTranslation();
  const totalBalance = useTotalBalance();
  const { autoSync, isLoaded: prefsLoaded, consentDataProcessing } = usePreferences();
  const syncAll = useSyncAllConnections();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (prefsLoaded && autoSync && consentDataProcessing && !hasSynced.current) {
      hasSynced.current = true;
      syncAll.mutate(undefined, { onError: () => {} });
    }
  }, [prefsLoaded, autoSync]);

  const now = new Date();
  const currentMonthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const today = format(now, 'yyyy-MM-dd');

  const { data: overviewData } = useMonthlyOverviewByRange(currentMonthStart, today);
  const monthlyData = overviewData?.data || [];

  // Sum all months in the range (should be just current month)
  const monthlyIncome = monthlyData.reduce((sum, m) => sum + Number(m.total_income), 0);
  const monthlyExpenses = monthlyData.reduce((sum, m) => sum + Number(m.total_expenses), 0);
  const netSavings = monthlyIncome - monthlyExpenses;

  if (!consentDataProcessing) {
    return (
      <AppLayout title={t('dashboard.title')}>
        <ConsentGate type="processing" />
      </AppLayout>
    );
  }

  return (
    <AppLayout 
      title={t('dashboard.title')}
      actions={<SyncButton />}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={t('dashboard.totalBalance')}
            value={totalBalance}
            icon={Wallet}
            description={t('dashboard.acrossAllAccounts')}
            action={<BalanceAccountsPicker />}
          />
          <StatCard
            title={t('dashboard.monthlyIncome')}
            value={monthlyIncome}
            icon={TrendingUp}
            variant="income"
            description={t('dashboard.thisMonth')}
          />
          <StatCard
            title={t('dashboard.monthlyExpenses')}
            value={monthlyExpenses}
            icon={TrendingDown}
            variant="expense"
            description={t('dashboard.thisMonth')}
          />
          <StatCard
            title={t('dashboard.netSavings')}
            value={netSavings}
            icon={PiggyBank}
            variant={netSavings >= 0 ? 'income' : 'expense'}
            description={t('dashboard.thisMonth')}
          />
        </div>

        <RecentTransactions />

        <div className="grid gap-6 lg:grid-cols-2">
          <SpendingChart />
          <AccountsList />
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
