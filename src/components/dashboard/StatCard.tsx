import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'income' | 'expense';
}

export function StatCard({ title, value, description, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && (
          <Icon className={cn(
            "h-5 w-5",
            variant === 'income' && "text-income",
            variant === 'expense' && "text-expense",
            variant === 'default' && "text-muted-foreground"
          )} />
        )}
      </CardHeader>
      <CardContent>
        <div className={cn(
          "text-2xl font-bold",
          variant === 'income' && "text-income",
          variant === 'expense' && "text-expense"
        )}>
          {typeof value === 'number' 
            ? new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value)
            : value
          }
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <p className={cn(
            "text-xs mt-1",
            trend.value >= 0 ? "text-income" : "text-expense"
          )}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
