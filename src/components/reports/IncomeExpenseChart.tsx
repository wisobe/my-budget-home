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
  Legend,
} from 'recharts';

interface IncomeExpenseChartProps {
  mode: 'ytd' | 'rolling';
}

export function IncomeExpenseChart({ mode }: IncomeExpenseChartProps) {
  const currentYear = new Date().getFullYear();
  const today = new Date();
  const rolling12Start = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1)
    .toISOString().split('T')[0];
  const rolling12End = today.toISOString().split('T')[0];

  const ytdQuery = useMonthlyOverview(currentYear);
  const rollingQuery = useMonthlyOverviewByRange(rolling12Start, rolling12End);

  const { data: overviewData, isLoading } = mode === 'ytd' ? ytdQuery : rollingQuery;

  const label = mode === 'ytd' ? `${currentYear}` : 'Rolling 12 Months';

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Income vs Expenses</CardTitle>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center">
          <div className="animate-pulse w-full h-full bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const monthlyData = overviewData?.data || [];

  const chartData = monthlyData.map(item => ({
    month: new Date(item.month + '-01').toLocaleDateString('en-CA', { month: 'short', year: '2-digit' }),
    income: Number(item.total_income),
    expenses: Number(item.total_expenses),
    savings: Number(item.net_savings),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income vs Expenses ({label})</CardTitle>
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
            <Legend />
            <Bar dataKey="income" name="Income" fill="hsl(var(--income))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--expense))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
