import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAccounts, useTotalBalance } from '@/hooks/use-accounts';
import { SyncButton } from '@/components/transactions/SyncButton';
import { Plus, CreditCard, Wallet, PiggyBank, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const accountTypeColors: Record<string, string> = {
  checking: 'bg-primary/10 text-primary',
  savings: 'bg-income/10 text-income',
  credit: 'bg-expense/10 text-expense',
  investment: 'bg-chart-3/10 text-chart-3',
  depository: 'bg-primary/10 text-primary',
  loan: 'bg-expense/10 text-expense',
  other: 'bg-muted text-muted-foreground',
};

const accountIcons: Record<string, typeof Wallet> = {
  checking: Wallet,
  savings: PiggyBank,
  credit: CreditCard,
  investment: TrendingUp,
  depository: Wallet,
  loan: CreditCard,
  other: Wallet,
};

const Accounts = () => {
  const { t } = useTranslation();
  const { data: accountsData, isLoading } = useAccounts();
  const totalBalance = useTotalBalance();

  const accounts = accountsData?.data || [];

  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.type]) acc[account.type] = [];
    acc[account.type].push(account);
    return acc;
  }, {} as Record<string, typeof accounts>);

  return (
    <AppLayout
      title={t('accounts.title')}
      actions={
        <div className="flex gap-2">
          <SyncButton />
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {t('accounts.addAccount')}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardDescription>{t('accounts.totalBalance')}</CardDescription>
            <CardTitle className="text-4xl">
              {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(totalBalance)}
            </CardTitle>
          </CardHeader>
        </Card>

        {Object.entries(groupedAccounts).map(([type, typeAccounts]) => {
          const Icon = accountIcons[type] || Wallet;
          const colorClass = accountTypeColors[type] || accountTypeColors.other;
          const typeTotal = typeAccounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0);

          return (
            <Card key={type}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", colorClass)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="capitalize">{t('accounts.accounts', { type })}</CardTitle>
                      <CardDescription>{t('accounts.accountCount', { count: typeAccounts.length })}</CardDescription>
                    </div>
                  </div>
                  <p className={cn("text-xl font-bold", typeTotal < 0 && "text-expense")}>
                    {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(typeTotal)}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {typeAccounts.map(account => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="font-medium">{account.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {account.institution_name}
                        {account.last_synced && (
                          <> • {t('accounts.lastSynced', { date: new Date(account.last_synced).toLocaleDateString() })}</>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn("font-semibold", Number(account.current_balance) < 0 && "text-expense")}>
                        {new Intl.NumberFormat('en-CA', { style: 'currency', currency: account.currency }).format(Number(account.current_balance))}
                      </p>
                      {account.available_balance !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          {t('accounts.available', {
                            amount: new Intl.NumberFormat('en-CA', { style: 'currency', currency: account.currency }).format(account.available_balance)
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppLayout>
  );
};

export default Accounts;
