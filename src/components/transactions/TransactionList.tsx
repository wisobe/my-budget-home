import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useTransactions,
  useCategories,
  useCategorizeTransaction,
  useExcludeTransaction,
} from '@/hooks/use-transactions';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Search, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight,
  MoreHorizontal, Split, EyeOff, Eye,
} from 'lucide-react';
import { SplitTransactionDialog } from './SplitTransactionDialog';
import { usePreferences } from '@/contexts/PreferencesContext';
import type { Transaction } from '@/types';

export function TransactionList() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showExcluded, setShowExcluded] = useState(false);
  const [splitTransaction, setSplitTransaction] = useState<Transaction | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);

  const { data: transactionsData, isLoading } = useTransactions({
    page,
    per_page: 15,
    search: search || undefined,
    category_id: categoryFilter !== 'all' ? categoryFilter : undefined,
    show_excluded: showExcluded,
  });

  const { data: categoriesData } = useCategories();
  const categorize = useCategorizeTransaction();
  const excludeMutation = useExcludeTransaction();

  const { showPending } = usePreferences();
  const transactions = (transactionsData?.data || []).filter(t => showPending || !t.pending);
  const categories = categoriesData?.data || [];
  const totalPages = transactionsData?.total_pages || 1;

  const handleCategorize = (transactionId: string, value: string) => {
    categorize.mutate({
      id: transactionId,
      category_id: value === 'none' ? null : value,
    });
  };

  const handleExclude = (transaction: Transaction) => {
    excludeMutation.mutate({ id: transaction.id, excluded: !transaction.excluded });
  };

  const handleSplit = (transaction: Transaction) => {
    setSplitTransaction(transaction);
    setSplitOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('transactions.searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t('transactions.allCategories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('transactions.allCategories')}</SelectItem>
            {categories.filter(c => !c.parent_id).map(category => {
              const children = categories.filter(c => c.parent_id === category.id);
              return [
                <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>,
                ...children.map(child => (
                  <SelectItem key={child.id} value={child.id}>
                    <span className="pl-3 text-muted-foreground">↳ {child.name}</span>
                  </SelectItem>
                )),
              ];
            })}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="show-excluded" checked={showExcluded} onCheckedChange={setShowExcluded} />
          <Label htmlFor="show-excluded" className="text-sm whitespace-nowrap">{t('transactions.showExcluded')}</Label>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>{t('transactions.description')}</TableHead>
              <TableHead>{t('transactions.category')}</TableHead>
              <TableHead>{t('transactions.date')}</TableHead>
              <TableHead className="text-right">{t('transactions.amount')}</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <div className="h-10 bg-muted animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t('transactions.noTransactions')}
                </TableCell>
              </TableRow>
            ) : (
              transactions.map(transaction => {
                const isIncome = transaction.amount < 0;
                const isExcluded = !!transaction.excluded;
                const hasSplits = (transaction.split_count ?? 0) > 0;

                return (
                  <TableRow key={transaction.id} className={cn(isExcluded && "opacity-50")}>
                    <TableCell>
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center",
                        isIncome ? "bg-income/10" : "bg-expense/10"
                      )}>
                        {isIncome ? (
                          <ArrowDownRight className="h-4 w-4 text-income" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-expense" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className={cn("font-medium", isExcluded && "line-through")}>{transaction.name}</p>
                        {transaction.merchant_name && transaction.merchant_name !== transaction.name && (
                          <p className="text-sm text-muted-foreground">{transaction.merchant_name}</p>
                        )}
                        <div className="flex gap-1 mt-1">
                          {!!transaction.pending && <Badge variant="outline" className="text-xs">{t('transactions.pending')}</Badge>}
                          {hasSplits && <Badge variant="secondary" className="text-xs">{t('transactions.split')}</Badge>}
                          {isExcluded && <Badge variant="destructive" className="text-xs">{t('transactions.excluded')}</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {hasSplits ? (
                        <Badge variant="secondary" className="cursor-pointer" onClick={() => handleSplit(transaction)}>
                          {t('transactions.splitEdit')}
                        </Badge>
                      ) : (
                        <Select
                          value={transaction.category_id || 'none'}
                          onValueChange={(value) => handleCategorize(transaction.id, value)}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue>
                              {transaction.category_id && transaction.category_name ? (
                                <div className="flex items-center gap-2">
                                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: transaction.category_color || '#6b7280' }} />
                                  {transaction.category_name}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">{t('transactions.select')}</span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground">{t('transactions.noneRemove')}</span>
                            </SelectItem>
                            {categories.filter(cat => !cat.parent_id).map(cat => {
                              const children = categories.filter(c => c.parent_id === cat.id);
                              return [
                                <SelectItem key={cat.id} value={cat.id}>
                                  <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                                    {cat.name}
                                  </div>
                                </SelectItem>,
                                ...children.map(child => (
                                  <SelectItem key={child.id} value={child.id}>
                                    <div className="flex items-center gap-2 pl-3">
                                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: child.color }} />
                                      {child.name}
                                    </div>
                                  </SelectItem>
                                )),
                              ];
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString('en-CA', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn("font-semibold", isIncome ? "text-income" : "text-expense")}>
                        {isIncome ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleSplit(transaction)}>
                            <Split className="h-4 w-4 mr-2" />
                            {hasSplits ? t('transactions.editSplit') : t('transactions.split')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExclude(transaction)}>
                            {isExcluded ? (
                              <><Eye className="h-4 w-4 mr-2" /> {t('transactions.include')}</>
                            ) : (
                              <><EyeOff className="h-4 w-4 mr-2" /> {t('transactions.exclude')}</>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t('transactions.pageOf', { page, total: totalPages })}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" /> {t('transactions.previous')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            {t('transactions.next')} <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <SplitTransactionDialog
        open={splitOpen}
        onOpenChange={setSplitOpen}
        transaction={splitTransaction}
      />
    </div>
  );
}
