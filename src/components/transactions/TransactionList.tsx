import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  useTransactions,
  useCategories,
  useCategorizeTransaction,
  useExcludeTransaction,
  useLockTransaction,
} from '@/hooks/use-transactions';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Search, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight,
  CalendarIcon, X, Lock, Pencil,
} from 'lucide-react';
import { SplitTransactionDialog } from './SplitTransactionDialog';
import { CategoryPicker } from './CategoryPicker';
import { TransactionActions } from './TransactionActions';
import { EditAmountDialog } from './EditAmountDialog';
import { usePreferences } from '@/contexts/PreferencesContext';
import type { Transaction } from '@/types';

export function TransactionList() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  // Read initial filter values from URL query params (for drill-down from budgets)
  const initialCategory = searchParams.get('category_id') || 'all';
  const initialStartDate = searchParams.get('start_date');
  const initialEndDate = searchParams.get('end_date');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory);
  const [showExcluded, setShowExcluded] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(initialStartDate ? new Date(initialStartDate + 'T00:00:00') : undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(initialEndDate ? new Date(initialEndDate + 'T00:00:00') : undefined);
  const [splitTransaction, setSplitTransaction] = useState<Transaction | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [editAmountTx, setEditAmountTx] = useState<Transaction | null>(null);
  const [editAmountOpen, setEditAmountOpen] = useState(false);

  const { data: transactionsData, isLoading } = useTransactions({
    page,
    per_page: 15,
    search: search || undefined,
    category_id: categoryFilter !== 'all' ? categoryFilter : undefined,
    show_excluded: showExcluded,
    start_date: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
    end_date: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
  });

  const { data: categoriesData } = useCategories();
  const categorize = useCategorizeTransaction();
  const excludeMutation = useExcludeTransaction();
  const lockMutation = useLockTransaction();

  const { showPending, autoLearnRules } = usePreferences();
  const transactions = (transactionsData?.data || []).filter(t => showPending || !t.pending);
  const categories = categoriesData?.data || [];
  const totalPages = transactionsData?.total_pages || 1;

  const handleCategorize = (transactionId: string, value: string) => {
    categorize.mutate({
      id: transactionId,
      category_id: value === 'none' ? null : value,
      learn_rule: autoLearnRules,
    });
  };

  const handleExclude = (transaction: Transaction) => {
    excludeMutation.mutate({ id: transaction.id, excluded: !transaction.excluded });
  };

  const handleLock = (transaction: Transaction) => {
    lockMutation.mutate({ id: transaction.id, locked: !transaction.auto_categorize_locked });
  };

  const handleSplit = (transaction: Transaction) => {
    setSplitTransaction(transaction);
    setSplitOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative w-full sm:w-[470px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('transactions.searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, 'MMM d, yyyy') : <span>{t('transactions.startDate')}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(d) => { setStartDate(d); setPage(1); }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          {startDate && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setStartDate(undefined); setPage(1); }}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, 'MMM d, yyyy') : <span>{t('transactions.endDate')}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(d) => { setEndDate(d); setPage(1); }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          {endDate && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEndDate(undefined); setPage(1); }}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t('transactions.allCategories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('transactions.allCategories')}</SelectItem>
            <SelectItem value="uncategorized">{t('transactions.uncategorized')}</SelectItem>
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
                          <ArrowUpRight className="h-4 w-4 text-income" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-expense" />
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
                          {!!transaction.auto_categorize_locked && (
                            <Badge
                              variant="outline"
                              className="text-xs cursor-pointer gap-1"
                              onClick={() => handleLock(transaction)}
                              title={t('transactions.unlockCategory')}
                            >
                              <Lock className="h-3 w-3" />
                              {t('transactions.categoryLocked')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {hasSplits ? (
                        <Badge variant="secondary" className="cursor-pointer" onClick={() => handleSplit(transaction)}>
                          {t('transactions.splitEdit')}
                        </Badge>
                      ) : (
                        <CategoryPicker
                          value={transaction.category_id}
                          categoryName={transaction.category_name}
                          categoryColor={transaction.category_color}
                          onSelect={(value) => handleCategorize(transaction.id, value)}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString('en-CA', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const displayAmount = hasSplits && transaction.included_split_amount != null
                          ? transaction.included_split_amount
                          : transaction.amount;
                        const displayIsIncome = Number(displayAmount) < 0;
                        const isForeign = transaction.iso_currency_code && transaction.iso_currency_code !== 'CAD' && transaction.original_amount != null;
                        const isOverridden = !!transaction.amount_overridden;
                        return (
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1">
                              <span className={cn("font-semibold", displayIsIncome ? "text-income" : "text-expense")}>
                                {displayIsIncome ? '+' : '-'}${Math.abs(Number(displayAmount)).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              {(isForeign || isOverridden) && !hasSplits && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                  title={t('transactions.editAmount')}
                                  onClick={() => { setEditAmountTx(transaction); setEditAmountOpen(true); }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            {isForeign && (
                              <span className="text-xs text-muted-foreground">
                                {Number(transaction.original_amount).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {transaction.iso_currency_code}
                                {isOverridden ? ` • ${t('transactions.manual')}` : ''}
                              </span>
                            )}
                            {!isForeign && isOverridden && (
                              <span className="text-xs text-muted-foreground">{t('transactions.manual')}</span>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="p-1">
                      <TransactionActions
                        transaction={transaction}
                        hasSplits={hasSplits}
                        isExcluded={isExcluded}
                        onSplit={handleSplit}
                        onToggleExclude={handleExclude}
                        onToggleLock={handleLock}
                      />
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
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" /><ChevronLeft className="h-4 w-4 -ml-2" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {(() => {
            const pages: (number | 'ellipsis')[] = [];
            if (totalPages <= 7) {
              for (let i = 1; i <= totalPages; i++) pages.push(i);
            } else {
              pages.push(1);
              if (page > 3) pages.push('ellipsis');
              for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
              if (page < totalPages - 2) pages.push('ellipsis');
              pages.push(totalPages);
            }
            return pages.map((p, i) =>
              p === 'ellipsis' ? (
                <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="icon"
                  className="h-8 w-8 text-xs"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              )
            );
          })()}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
            <ChevronRight className="h-4 w-4" /><ChevronRight className="h-4 w-4 -ml-2" />
          </Button>
        </div>
      </div>

      <SplitTransactionDialog
        open={splitOpen}
        onOpenChange={setSplitOpen}
        transaction={splitTransaction}
      />

      <EditAmountDialog
        open={editAmountOpen}
        onOpenChange={setEditAmountOpen}
        transaction={editAmountTx}
      />
    </div>
  );
}
