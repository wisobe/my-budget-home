import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { AccountsList } from '@/components/dashboard/AccountsList';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { SpendingChart } from '@/components/dashboard/SpendingChart';
import { useAccounts, useTotalBalance } from '@/hooks/use-accounts';
import { useTransactions } from '@/hooks/use-transactions';
import { SyncButton } from '@/components/transactions/SyncButton';
import { useSyncAllConnections } from '@/hooks/use-plaid';
import { usePreferences } from '@/contexts/PreferencesContext';
import { Wallet, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';

const Dashboard = () => {
  const { t } = useTranslation();
  const totalBalance = useTotalBalance();
  const { data: transactionsData } = useTransactions({ per_page: 100 });
  const { autoSync, showPending } = usePreferences();
  const syncAll = useSyncAllConnections();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (autoSync && !hasSynced.current) {
      hasSynced.current = true;
      syncAll.mutate(undefined, { onError: () => {} });
    }
  }, [autoSync]);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const transactions = (transactionsData?.data || [])
    .filter(t => !t.pending)
    .filter(t => !t.excluded);
  const thisMonthTransactions = transactions.filter(t => new Date(t.date) >= startOfMonth);
  
  const getEffectiveAmount = (t: typeof transactions[0]) => {
    if ((t.split_count ?? 0) > 0 && t.included_split_amount != null) {
      return Math.abs(Number(t.included_split_amount));
    }
    return Math.abs(Number(t.amount));
  };

  const isIncomeTransaction = (t: typeof transactions[0]) => !!t.category_is_income;

  const monthlyIncome = thisMonthTransactions
    .filter(t => isIncomeTransaction(t))
    .reduce((sum, t) => sum + getEffectiveAmount(t), 0);
  
  const monthlyExpenses = thisMonthTransactions
    .filter(t => !isIncomeTransaction(t))
    .reduce((sum, t) => sum + getEffectiveAmount(t), 0);

  const netSavings = monthlyIncome - monthlyExpenses;

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
