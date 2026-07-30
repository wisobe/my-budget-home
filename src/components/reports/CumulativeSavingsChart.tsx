import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMonthlyOverviewByRange } from '@/hooks/use-reports';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface CumulativeSavingsChartProps {
  startDate: string;
  endDate: string;
  height?: number;
}

export function CumulativeSavingsChart({ startDate, endDate, height = 300 }: CumulativeSavingsChartProps) {
  const { t } = useTranslation();
  const { data: overviewData, isLoading } = useMonthlyOverviewByRange(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>{t('reports.cumulativeSavings')}</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center" style={{ height }}>
          <div className="animate-pulse w-full h-full bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const monthlyData = overviewData?.data || [];
  let running = 0;
  const chartData = monthlyData.map(item => {
    running += Number(item.net_savings);
    return {
      month: new Date(item.month + '-01T12:00:00').toLocaleDateString('en-CA', { month: 'short', year: '2-digit' }),
      cumulative: running,
    };
  });

  return (
    <Card>
      <CardHeader><CardTitle>{t('reports.cumulativeSavings')}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="cumulativeSavingsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
            <YAxis className="text-xs fill-muted-foreground" tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`} />
            <Tooltip
              formatter={(value: number) => [
                new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value),
                t('reports.cumulativeSavings'),
              ]}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              fill="url(#cumulativeSavingsFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
