import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { budgetsApi } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import type { BudgetWithSpent } from '@/types';

interface BudgetHistoryChartProps {
  budget: BudgetWithSpent;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getMonthDateRange(monthStr: string): { start: string; end: string } {
  const [year, month] = monthStr.split('-').map(Number);
  const endDate = new Date(year, month, 0); // day 0 of next month = last day of current month
  return {
    start: `${monthStr}-01`,
    end: `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`,
  };
}

function parseMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

export function BudgetHistoryChart({ budget }: BudgetHistoryChartProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['budget-history', budget.category_id, budget.period],
    queryFn: () => budgetsApi.history(budget.category_id, budget.period),
  });

  const months = data?.data ?? [];

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (months.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t('budgets.noHistory')}
      </p>
    );
  }

  // Format month labels (e.g. "2025-03" → "Mar")
  const chartData = months.map((m) => ({
    ...m,
    label: parseMonthLabel(m.month),
  }));

  const budgetLimit = budget.amount;

  const handleBarClick = (data: { month: string }) => {
    const { start, end } = getMonthDateRange(data.month);
    const params = new URLSearchParams({
      category_id: budget.category_id,
      start_date: start,
      end_date: end,
    });
    navigate(`/transactions?${params.toString()}`);
  };

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-primary" />
            <span>{t('budgets.spending')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-destructive" />
            <span>{t('budgets.budgetLimit')}: {formatCurrency(budgetLimit)}</span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">{t('budgets.clickToViewTransactions')}</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v)}
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            width={60}
          />
          <Tooltip
            formatter={(value: number) => [formatCurrency(value), t('budgets.spending')]}
            labelFormatter={(label) => label}
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              color: 'hsl(var(--popover-foreground))',
            }}
            cursor={{ fill: 'hsl(var(--muted))' }}
          />
          <ReferenceLine
            y={budgetLimit}
            stroke="hsl(var(--destructive))"
            strokeDasharray="4 4"
            strokeWidth={2}
          />
          <Bar
            dataKey="spent"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
            onClick={(data) => handleBarClick(data)}
            className="cursor-pointer"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  entry.spent > budgetLimit
                    ? 'hsl(var(--destructive))'
                    : 'hsl(var(--primary))'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
