import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSpendingByCategory } from '@/hooks/use-reports';
import { useCategories, useTransactions } from '@/hooks/use-transactions';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, ArrowLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/contexts/PreferencesContext';

interface CategoryBreakdownProps {
  startDate: string;
  endDate: string;
}

type DrillLevel = 'parents' | 'children' | 'transactions';

export function CategoryBreakdown({ startDate, endDate }: CategoryBreakdownProps) {
  const { t } = useTranslation();
  const { data: spendingData, isLoading } = useSpendingByCategory(startDate, endDate);
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.data || [];
  const [drillLevel, setDrillLevel] = useState<DrillLevel>('parents');
  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  // Fetch transactions for the selected child category
  const { data: txData, isLoading: txLoading } = useTransactions({
    category_id: selectedChildId || undefined,
    start_date: startDate,
    end_date: endDate,
    per_page: 100,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>{t('reports.categoryBreakdown')}</CardTitle></CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-muted rounded" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const insights = spendingData?.data || [];
  const expenseInsights = insights.filter(i => {
    const cat = categories.find(c => c.id === i.category_id);
    return !cat?.is_income;
  });

  // Group by parent
  const parentMap = new Map<string, { parentId: string; parentName: string; parentColor: string; total: number; count: number; children: typeof expenseInsights; trend: string; trendPct: number }>();

  for (const insight of expenseInsights) {
    const cat = categories.find(c => c.id === insight.category_id);
    const parentId = cat?.parent_id || insight.category_id;
    const parentCat = cat?.parent_id ? categories.find(c => c.id === cat.parent_id) : cat;

    const existing = parentMap.get(parentId);
    if (existing) {
      existing.total += insight.total_amount;
      existing.count += insight.transaction_count;
      existing.children.push(insight);
    } else {
      parentMap.set(parentId, {
        parentId,
        parentName: parentCat?.name || insight.category_name,
        parentColor: parentCat?.color || '#6b7280',
        total: insight.total_amount,
        count: insight.transaction_count,
        children: [insight],
        trend: insight.trend,
        trendPct: insight.trend_percentage || 0,
      });
    }
  }

  const parentRows = Array.from(parentMap.values()).sort((a, b) => b.total - a.total);
  const grandTotal = parentRows.reduce((s, r) => s + r.total, 0);
  const maxParentAmount = Math.max(...parentRows.map(r => r.total), 1);

  const expandedData = expandedParentId ? parentMap.get(expandedParentId) : null;
  const expandedMaxAmount = expandedData ? Math.max(...expandedData.children.map(c => c.total_amount), 1) : 1;

  const selectedChild = selectedChildId ? insights.find(i => i.category_id === selectedChildId) : null;
  const selectedChildCat = selectedChildId ? categories.find(c => c.id === selectedChildId) : null;

  const handleParentClick = (parentId: string, hasChildren: boolean) => {
    if (!hasChildren) return;
    setExpandedParentId(parentId);
    setDrillLevel('children');
  };

  const handleChildClick = (childId: string) => {
    setSelectedChildId(childId);
    setDrillLevel('transactions');
  };

  const handleBackToChildren = () => {
    setSelectedChildId(null);
    setDrillLevel('children');
  };

  const handleBackToParents = () => {
    setExpandedParentId(null);
    setSelectedChildId(null);
    setDrillLevel('parents');
  };

  const transactions = txData?.data || [];

  return (
    <Card>
      <CardHeader><CardTitle>{t('reports.categoryBreakdown')}</CardTitle></CardHeader>
      <CardContent>
        <div className="relative overflow-hidden">
          {/* Parent view */}
          <div className={cn(
            "transition-all duration-300 ease-in-out space-y-4",
            drillLevel !== 'parents' ? "-translate-x-full opacity-0 absolute inset-0" : "translate-x-0 opacity-100"
          )}>
            {parentRows.map(row => {
              const percentage = (row.total / maxParentAmount) * 100;
              const pctOfTotal = grandTotal > 0 ? ((row.total / grandTotal) * 100).toFixed(1) : '0';
              const hasChildren = row.children.length > 1 || (row.children.length === 1 && categories.find(c => c.id === row.children[0].category_id)?.parent_id);

              return (
                <div
                  key={row.parentId}
                  className={cn("space-y-2", hasChildren && "cursor-pointer group")}
                  onClick={() => handleParentClick(row.parentId, !!hasChildren)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: row.parentColor }} />
                      <span className="font-medium">{row.parentName}</span>
                      {hasChildren && <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(row.total)}
                      </span>
                      <TrendIcon trend={row.trend} trendPct={row.trendPct} />
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2" style={{ '--progress-foreground': row.parentColor } as React.CSSProperties} />
                  <p className="text-xs text-muted-foreground">
                    {t('reports.transactions_count', { count: row.count })} • {t('reports.ofTotal', { percentage: pctOfTotal })}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Child view */}
          <div className={cn(
            "transition-all duration-300 ease-in-out space-y-4",
            drillLevel === 'children' ? "translate-x-0 opacity-100" : drillLevel === 'parents' ? "translate-x-full opacity-0 absolute inset-0" : "-translate-x-full opacity-0 absolute inset-0"
          )}>
            {expandedData && (
              <>
                <button
                  onClick={handleBackToParents}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('reports.backToCategories')}
                </button>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="h-5 w-5 rounded-full" style={{ backgroundColor: expandedData.parentColor }} />
                  <span className="font-semibold text-lg">{expandedData.parentName}</span>
                  <span className="text-muted-foreground ml-auto font-semibold">
                    {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(expandedData.total)}
                  </span>
                </div>
                {expandedData.children.sort((a, b) => b.total_amount - a.total_amount).map(insight => {
                  const category = categories.find(c => c.id === insight.category_id);
                  const percentage = (insight.total_amount / expandedMaxAmount) * 100;
                  const pctOfParent = expandedData.total > 0 ? ((insight.total_amount / expandedData.total) * 100).toFixed(1) : '0';

                  return (
                    <div
                      key={insight.category_id}
                      className="space-y-2 cursor-pointer group"
                      onClick={() => handleChildClick(insight.category_id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: category?.color || '#6b7280' }} />
                          <span className="font-medium">{insight.category_name}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(insight.total_amount)}
                          </span>
                          <TrendIcon trend={insight.trend} trendPct={insight.trend_percentage || 0} />
                        </div>
                      </div>
                      <Progress value={percentage} className="h-2" style={{ '--progress-foreground': category?.color || '#6b7280' } as React.CSSProperties} />
                      <p className="text-xs text-muted-foreground">
                        {t('reports.transactions_count', { count: insight.transaction_count })} • {pctOfParent}%
                      </p>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Transaction view */}
          <div className={cn(
            "transition-all duration-300 ease-in-out space-y-4",
            drillLevel === 'transactions' ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 absolute inset-0"
          )}>
            {selectedChild && (
              <>
                <button
                  onClick={handleBackToChildren}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('reports.backToSubcategories')}
                </button>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="h-5 w-5 rounded-full" style={{ backgroundColor: selectedChildCat?.color || '#6b7280' }} />
                  <span className="font-semibold text-lg">{selectedChild.category_name}</span>
                  <span className="text-muted-foreground ml-auto font-semibold">
                    {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(selectedChild.total_amount)}
                  </span>
                </div>
                {txLoading ? (
                  <div className="animate-pulse space-y-3">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-muted rounded" />)}
                  </div>
                ) : transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t('transactions.noTransactions')}</p>
                ) : (
                  <div className="space-y-1">
                    {transactions.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{tx.name}</p>
                          <p className="text-xs text-muted-foreground">{new Date(tx.date + 'T12:00:00').toLocaleDateString()}</p>
                        </div>
                        <span className="font-semibold text-sm ml-4">
                          {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendIcon({ trend, trendPct }: { trend: string; trendPct: number }) {
  if (trend === 'up') {
    return (
      <div className="flex items-center text-expense text-xs">
        <TrendingUp className="h-3 w-3 mr-1" />{trendPct}%
      </div>
    );
  }
  if (trend === 'down') {
    return (
      <div className="flex items-center text-income text-xs">
        <TrendingDown className="h-3 w-3 mr-1" />{Math.abs(trendPct)}%
      </div>
    );
  }
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}
