import { useTranslation } from 'react-i18next';
import { Settings2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useAccounts } from '@/hooks/use-accounts';
import { usePreferences } from '@/contexts/PreferencesContext';

export function BalanceAccountsPicker() {
  const { t } = useTranslation();
  const { data: accountsData } = useAccounts();
  const { balanceAccounts, setBalanceAccounts } = usePreferences();

  const accounts = (accountsData?.data || []).filter(a => !a.excluded);

  const toggleAccount = (accountId: string) => {
    if (balanceAccounts.length === 0) {
      // Currently "all" — switching to explicit: select all except this one
      const allIds = accounts.map(a => String(a.id));
      setBalanceAccounts(allIds.filter(id => id !== accountId));
    } else if (balanceAccounts.includes(accountId)) {
      const next = balanceAccounts.filter(id => id !== accountId);
      // If removing last one, revert to "all"
      setBalanceAccounts(next.length === 0 ? [] : next);
    } else {
      const next = [...balanceAccounts, accountId];
      // If all are now selected, revert to "all" (empty = all)
      if (next.length === accounts.length) {
        setBalanceAccounts([]);
      } else {
        setBalanceAccounts(next);
      }
    }
  };

  const isChecked = (accountId: string) =>
    balanceAccounts.length === 0 || balanceAccounts.includes(accountId);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t('dashboard.configureBalance', 'Configure balance')}
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <p className="text-sm font-medium">{t('dashboard.selectAccounts', 'Select accounts for total balance')}</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {accounts.map(account => (
              <label
                key={account.id}
                className="flex items-center gap-2 cursor-pointer rounded-md p-1.5 hover:bg-muted transition-colors"
              >
                <Checkbox
                  checked={isChecked(String(account.id))}
                  onCheckedChange={() => toggleAccount(String(account.id))}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{account.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{account.institution_name}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
