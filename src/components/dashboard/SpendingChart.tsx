import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSpendingByCategory } from '@/hooks/use-reports';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { mockCategories } from '@/lib/mock-data';

export function SpendingChart() {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data: spendingData, isLoading } = useSpendingByCategory(startOfMonth, endOfMonth);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending by Category</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="animate-pulse h-48 w-48 rounded-full bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const insights = spendingData?.data || [];
  
  const chartData = insights
    .filter(i => !mockCategories.find(c => c.id === i.category_id)?.is_income)
    .map(insight => ({
      name: insight.category_name,
      value: insight.total_amount,
      color: mockCategories.find(c => c.id === insight.category_id)?.color || '#888888',
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Category</CardTitle>
      </CardHeader>
      <CardContent>
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
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
