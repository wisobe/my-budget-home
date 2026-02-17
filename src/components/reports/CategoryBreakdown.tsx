import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSpendingByCategory } from '@/hooks/use-reports';
import { useCategories } from '@/hooks/use-transactions';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CategoryBreakdownProps {
  startDate: string;
  endDate: string;
}

export function CategoryBreakdown({ startDate, endDate }: CategoryBreakdownProps) {
  const { data: spendingData, isLoading } = useSpendingByCategory(startDate, endDate);
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.data || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Category Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-muted rounded" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const insights = spendingData?.data || [];
  const expenseCategories = insights.filter(i => {
    const cat = categories.find(c => c.id === i.category_id);
    return !cat?.is_income;
  });

  const maxAmount = Math.max(...expenseCategories.map(i => i.total_amount), 1);

  return (
    <Card>
      <CardHeader><CardTitle>Category Breakdown</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {expenseCategories.map(insight => {
          const category = categories.find(c => c.id === insight.category_id);
          const percentage = (insight.total_amount / maxAmount) * 100;

          return (
            <div key={insight.category_id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: category?.color }} />
                  <span className="font-medium">{insight.category_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(insight.total_amount)}
                  </span>
                  {insight.trend === 'up' && (
                    <div className="flex items-center text-expense text-xs">
                      <TrendingUp className="h-3 w-3 mr-1" />{insight.trend_percentage}%
                    </div>
                  )}
                  {insight.trend === 'down' && (
                    <div className="flex items-center text-income text-xs">
                      <TrendingDown className="h-3 w-3 mr-1" />{Math.abs(insight.trend_percentage || 0)}%
                    </div>
                  )}
                  {insight.trend === 'stable' && <Minus className="h-3 w-3 text-muted-foreground" />}
                </div>
              </div>
              <Progress value={percentage} className="h-2" style={{ '--progress-foreground': category?.color } as React.CSSProperties} />
              <p className="text-xs text-muted-foreground">
                {insight.transaction_count} transactions • {insight.percentage_of_total}% of total
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
