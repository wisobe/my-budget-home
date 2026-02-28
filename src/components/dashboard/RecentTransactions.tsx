import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTransactions } from '@/hooks/use-transactions';
import { useCategories } from '@/hooks/use-transactions';
import { usePreferences } from '@/contexts/PreferencesContext';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export function RecentTransactions() {
  const { t } = useTranslation();
  const { data: transactionsData, isLoading } = useTransactions({ per_page: 5 });
  const { data: categoriesData } = useCategories();

  const categories = categoriesData?.data || [];
  const getCategoryName = (id?: string) => {
    if (!id) return t('dashboard.uncategorized');
    return categories.find(c => c.id === id)?.name || t('dashboard.unknown');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recentTransactions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-14 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { showPending } = usePreferences();
  const transactions = (transactionsData?.data || []).filter(t => showPending || !t.pending);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.recentTransactions')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {transactions.map(transaction => {
          const effectiveAmount = (transaction.split_count ?? 0) > 0 && transaction.included_split_amount != null
            ? transaction.included_split_amount
            : transaction.amount;
          const isIncome = effectiveAmount < 0;
          
          return (
            <div
              key={transaction.id}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center",
                  isIncome ? "bg-income/10" : "bg-expense/10"
                )}>
                  {isIncome ? (
                    <ArrowDownRight className="h-4 w-4 text-income" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-expense" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">{transaction.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {getCategoryName(transaction.category_id)} • {transaction.date}
                  </p>
                </div>
              </div>
              <p className={cn(
                "font-semibold",
                isIncome ? "text-income" : "text-expense"
              )}>
                {isIncome ? '+' : '-'}${Math.abs(effectiveAmount).toFixed(2)}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
