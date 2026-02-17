import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMonthlyOverview, useMonthlyOverviewByRange } from '@/hooks/use-reports';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';

interface NetSavingsChartProps {
  mode: 'ytd' | 'rolling';
}

export function NetSavingsChart({ mode }: NetSavingsChartProps) {
  const currentYear = new Date().getFullYear();
  const today = new Date();
  const rolling12Start = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1)
    .toISOString().split('T')[0];
  const rolling12End = today.toISOString().split('T')[0];

  const ytdQuery = useMonthlyOverview(currentYear);
  const rollingQuery = useMonthlyOverviewByRange(rolling12Start, rolling12End);

  const { data: overviewData, isLoading } = mode === 'ytd' ? ytdQuery : rollingQuery;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Net Savings by Month</CardTitle>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center">
          <div className="animate-pulse w-full h-full bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const monthlyData = overviewData?.data || [];

  const chartData = monthlyData.map(item => ({
    month: new Date(item.month + '-01T12:00:00').toLocaleDateString('en-CA', { month: 'short', year: '2-digit' }),
    net: Number(item.net_savings),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Savings by Month</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="month"
              className="text-xs fill-muted-foreground"
            />
            <YAxis
              className="text-xs fill-muted-foreground"
              tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
            />
            <Tooltip
              formatter={(value: number) =>
                new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value)
              }
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
            <Bar dataKey="net" name="Net Savings" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.net >= 0 ? 'hsl(var(--income))' : 'hsl(var(--expense))'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
