import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMonthlyOverviewByRange } from '@/hooks/use-reports';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface SavingsRateChartProps {
  startDate: string;
  endDate: string;
}

export function SavingsRateChart({ startDate, endDate }: SavingsRateChartProps) {
  const { t } = useTranslation();
  const { data: overviewData, isLoading } = useMonthlyOverviewByRange(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>{t('reports.savingsRateTrend')}</CardTitle></CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="animate-pulse w-full h-full bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const monthlyData = overviewData?.data || [];
  const chartData = monthlyData.map(item => ({
    month: new Date(item.month + '-01T12:00:00').toLocaleDateString('en-CA', { month: 'short', year: '2-digit' }),
    rate: Number(item.savings_rate),
    savings: Number(item.net_savings),
  }));

  return (
    <Card>
      <CardHeader><CardTitle>{t('reports.savingsRateTrend')}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
            <YAxis className="text-xs fill-muted-foreground" tickFormatter={(value) => `${value}%`} domain={[0, 'auto']} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'rate') return [`${value.toFixed(1)}%`, t('reports.savingsRate')];
                return [
                  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value),
                  t('reports.netSavings')
                ];
              }}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Line
              type="monotone"
              dataKey="rate"
              name="rate"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
