import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { AccountsList } from '@/components/dashboard/AccountsList';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { SpendingChart } from '@/components/dashboard/SpendingChart';
import { useAccounts, useTotalBalance } from '@/hooks/use-accounts';
import { useTransactions } from '@/hooks/use-transactions';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wallet, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';

const Dashboard = () => {
  const totalBalance = useTotalBalance();
  const { data: transactionsData } = useTransactions({ per_page: 100 });

  // Calculate this month's income and expenses
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const transactions = transactionsData?.data || [];
  const thisMonthTransactions = transactions.filter(t => new Date(t.date) >= startOfMonth);
  
  const monthlyIncome = thisMonthTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const monthlyExpenses = thisMonthTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const netSavings = monthlyIncome - monthlyExpenses;

  return (
    <AppLayout 
      title="Dashboard"
      actions={
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync Accounts
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Balance"
            value={totalBalance}
            icon={Wallet}
            description="Across all accounts"
          />
          <StatCard
            title="Monthly Income"
            value={monthlyIncome}
            icon={TrendingUp}
            variant="income"
            description="This month"
          />
          <StatCard
            title="Monthly Expenses"
            value={monthlyExpenses}
            icon={TrendingDown}
            variant="expense"
            description="This month"
          />
          <StatCard
            title="Net Savings"
            value={netSavings}
            icon={PiggyBank}
            variant={netSavings >= 0 ? 'income' : 'expense'}
            description="This month"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          <SpendingChart />
          <AccountsList />
        </div>

        {/* Recent Transactions */}
        <RecentTransactions />
      </div>
    </AppLayout>
  );
};

export default Dashboard;
