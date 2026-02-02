import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMonthlyOverview } from '@/hooks/use-reports';
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

export function IncomeExpenseChart() {
  const currentYear = new Date().getFullYear();
  const { data: overviewData, isLoading } = useMonthlyOverview(currentYear);

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
    month: new Date(item.month + '-01').toLocaleDateString('en-CA', { month: 'short' }),
    income: item.total_income,
    expenses: item.total_expenses,
    savings: item.net_savings,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income vs Expenses ({currentYear})</CardTitle>
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
