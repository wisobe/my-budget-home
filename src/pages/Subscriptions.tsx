import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';
import { useQuery } from '@tanstack/react-query';
import { subscriptionsApi } from '@/lib/api';
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Clock, DollarSign, CalendarDays } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Subscription {
  merchant: string;
  frequency: string;
  amount: number;
  avg_amount: number;
  occurrence_count: number;
  last_date: string;
  next_expected_date: string;
  status: 'active' | 'due_soon' | 'missed';
  price_change: { previous: number; current: number; change_percent: number; direction: string } | null;
  category_name: string | null;
  category_color: string | null;
  monthly_cost: number;
  annual_cost: number;
}

interface SubscriptionData {
  subscriptions: Subscription[];
  summary: {
    total_count: number;
    total_monthly: number;
    total_annual: number;
    missed_count: number;
    price_changes: number;
  };
}

const Subscriptions = () => {
  const { t } = useTranslation();
  const { environment } = usePlaidEnvironment();

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions', environment],
    queryFn: () => subscriptionsApi.list(environment),
  });

  const subData = data?.data as SubscriptionData | undefined;

  const statusConfig = {
    active: { label: 'Active', variant: 'default' as const, icon: RefreshCw },
    due_soon: { label: 'Due Soon', variant: 'secondary' as const, icon: Clock },
    missed: { label: 'Missed', variant: 'destructive' as const, icon: AlertTriangle },
  };

  const frequencyLabels: Record<string, string> = {
    weekly: 'Weekly',
    biweekly: 'Bi-weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    annual: 'Annual',
  };

  return (
    <AppLayout title={t('subscriptions.title', 'Subscriptions')}>
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold">{subData?.summary.total_count ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly Cost</p>
                    <p className="text-2xl font-bold">${subData?.summary.total_monthly?.toFixed(2) ?? '0.00'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CalendarDays className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Annual Cost</p>
                    <p className="text-2xl font-bold">${subData?.summary.total_annual?.toFixed(2) ?? '0.00'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Alerts</p>
                    <p className="text-2xl font-bold">{(subData?.summary.missed_count ?? 0) + (subData?.summary.price_changes ?? 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Subscription List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detected Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              {!subData?.subscriptions.length ? (
                <p className="text-muted-foreground text-center py-8">No recurring subscriptions detected yet. More transaction history will improve detection.</p>
              ) : (
                <div className="space-y-3">
                  {subData.subscriptions.map((sub, i) => {
                    const statusCfg = statusConfig[sub.status];
                    const StatusIcon = statusCfg.icon;
                    return (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                               style={{ backgroundColor: sub.category_color ? `${sub.category_color}20` : 'hsl(var(--muted))' }}>
                            <StatusIcon className="h-4 w-4" style={{ color: sub.category_color || 'hsl(var(--muted-foreground))' }} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{sub.merchant}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{frequencyLabels[sub.frequency] ?? sub.frequency}</span>
                              {sub.category_name && (
                                <>
                                  <span>·</span>
                                  <span>{sub.category_name}</span>
                                </>
                              )}
                              <span>·</span>
                              <span>Next: {format(parseISO(sub.next_expected_date), 'MMM d')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {sub.price_change && (
                            <div className={`flex items-center gap-1 text-xs ${sub.price_change.direction === 'increase' ? 'text-destructive' : 'text-green-600'}`}>
                              {sub.price_change.direction === 'increase' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {Math.abs(sub.price_change.change_percent)}%
                            </div>
                          )}
                          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                          <span className="font-semibold tabular-nums">${sub.amount.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppLayout>
  );
};

export default Subscriptions;
