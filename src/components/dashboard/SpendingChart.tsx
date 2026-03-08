import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSpendingByCategory } from '@/hooks/use-reports';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const FALLBACK_COLORS = ['#22c55e', '#f97316', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444', '#6366f1'];

export function SpendingChart() {
  const { t } = useTranslation();
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data: spendingData, isLoading } = useSpendingByCategory(startOfMonth, endOfMonth);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.spendingByCategory')}</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="animate-pulse h-48 w-48 rounded-full bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const insights = spendingData?.data || [];

  const chartData = insights
    .filter(i => i.total_amount > 0)
    .map((insight, index) => ({
      name: insight.category_name,
      value: insight.total_amount,
      color: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      trend: insight.trend,
      trendPct: insight.trend_percentage || 0,
      pctOfTotal: insight.percentage_of_total || 0,
      count: insight.transaction_count,
    }));

  const totalSpending = chartData.reduce((sum, d) => sum + d.value, 0);
  const top10 = chartData.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.spendingByCategory')}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            {t('dashboard.noSpendingData')}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Donut chart with center total */}
            <div className="relative">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) =>
                      new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value)
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center total */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">{t('dashboard.totalSpending')}</p>
                  <p className="text-lg font-bold text-foreground">
                    {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(totalSpending)}
                  </p>
                </div>
              </div>
            </div>

            {/* Top 10 categories list */}
            <div className="space-y-2">
              {top10.map((item, index) => (
                <div key={index} className="flex items-center gap-3 py-1.5">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-medium truncate flex-1">{item.name}</span>
                  <TrendBadge trend={item.trend} trendPct={item.trendPct} />
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrendBadge({ trend, trendPct }: { trend: string; trendPct: number }) {
  if (trend === 'up') {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-expense shrink-0">
        <TrendingUp className="h-3 w-3" />
        {trendPct}%
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-income shrink-0">
        <TrendingDown className="h-3 w-3" />
        {Math.abs(trendPct)}%
      </span>
    );
  }
  return <Minus className="h-3 w-3 text-muted-foreground shrink-0" />;
}
