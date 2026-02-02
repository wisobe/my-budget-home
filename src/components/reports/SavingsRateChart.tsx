import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMonthlyOverview } from '@/hooks/use-reports';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export function SavingsRateChart() {
  const currentYear = new Date().getFullYear();
  const { data: overviewData, isLoading } = useMonthlyOverview(currentYear);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Savings Rate Trend</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="animate-pulse w-full h-full bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const monthlyData = overviewData?.data || [];

  const chartData = monthlyData.map(item => ({
    month: new Date(item.month + '-01').toLocaleDateString('en-CA', { month: 'short' }),
    rate: item.savings_rate,
    savings: item.net_savings,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Savings Rate Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="month" 
              className="text-xs fill-muted-foreground"
            />
            <YAxis 
              className="text-xs fill-muted-foreground"
              tickFormatter={(value) => `${value}%`}
              domain={[0, 'auto']}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'rate') return [`${value.toFixed(1)}%`, 'Savings Rate'];
                return [
                  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value),
                  'Net Savings'
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
