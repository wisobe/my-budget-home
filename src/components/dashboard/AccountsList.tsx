import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccounts } from '@/hooks/use-accounts';
import { CreditCard, Wallet, PiggyBank, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const accountIcons: Record<string, typeof Wallet> = {
  checking: Wallet,
  savings: PiggyBank,
  credit: CreditCard,
  investment: TrendingUp,
  depository: Wallet,
  loan: CreditCard,
  other: Wallet,
};

export function AccountsList() {
  const { t } = useTranslation();
  const { data: accountsData, isLoading } = useAccounts();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('accounts.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const accounts = (accountsData?.data || []).filter(a => !a.excluded);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('accounts.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {accounts.map(account => {
          const Icon = accountIcons[account.type] || Wallet;
          const isNegative = Number(account.current_balance) < 0;
          
          return (
            <div
              key={account.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center",
                  account.type === 'credit' ? "bg-expense/10" : "bg-primary/10"
                )}>
                  <Icon className={cn(
                    "h-5 w-5",
                    account.type === 'credit' ? "text-expense" : "text-primary"
                  )} />
                </div>
                <div>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-sm text-muted-foreground">{account.institution_name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn(
                  "font-semibold",
                  isNegative ? "text-expense" : "text-foreground"
                )}>
                  {new Intl.NumberFormat('en-CA', { 
                    style: 'currency', 
                    currency: account.currency 
                  }).format(Math.abs(Number(account.current_balance)))}
                </p>
                <p className="text-xs text-muted-foreground capitalize">{account.type}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
