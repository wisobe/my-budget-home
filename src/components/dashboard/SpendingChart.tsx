import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSpendingByCategory } from '@/hooks/use-reports';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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
    }));

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
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
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
        )}
      </CardContent>
    </Card>
  );
}
