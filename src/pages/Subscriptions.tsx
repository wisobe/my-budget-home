import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionsApi } from '@/lib/api';
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Clock, DollarSign, CalendarDays, EyeOff, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

interface Subscription {
  merchant: string;
  merchant_key: string;
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
  dismissed: boolean;
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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);

const Subscriptions = () => {
  const { t } = useTranslation();
  const { plaidEnvironment: environment } = usePlaidEnvironment();
  const queryClient = useQueryClient();
  const [showDismissed, setShowDismissed] = useState(false);
  const [filterAlerts, setFilterAlerts] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions', environment],
    queryFn: () => subscriptionsApi.list(environment),
  });

  const dismissMutation = useMutation({
    mutationFn: ({ merchantKey, dismiss }: { merchantKey: string; dismiss: boolean }) =>
      subscriptionsApi.dismiss(merchantKey, dismiss, environment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success(t('subscriptions.listUpdated'));
    },
  });

  const subData = data?.data as SubscriptionData | undefined;

  const visibleSubs = (subData?.subscriptions.filter(s => showDismissed || !s.dismissed) ?? [])
    .filter(s => !filterAlerts || s.status === 'missed' || (s.price_change !== null && s.price_change.direction === 'increase'));
  const activeSubs = subData?.subscriptions.filter(s => !s.dismissed) ?? [];

  const statusConfig = {
    active: { label: t('subscriptions.active'), variant: 'default' as const, icon: RefreshCw },
    due_soon: { label: t('subscriptions.dueSoon'), variant: 'secondary' as const, icon: Clock },
    missed: { label: t('subscriptions.missed'), variant: 'destructive' as const, icon: AlertTriangle },
  };

  const frequencyLabels: Record<string, string> = {
    weekly: t('subscriptions.weekly'),
    biweekly: t('subscriptions.biweekly'),
    monthly: t('subscriptions.monthly'),
    quarterly: t('subscriptions.quarterly'),
    annual: t('subscriptions.annual'),
  };

  const summaryMonthly = activeSubs.reduce((sum, s) => sum + s.monthly_cost, 0);
  const summaryAnnual = activeSubs.reduce((sum, s) => sum + s.annual_cost, 0);
  const alertSubs = activeSubs.filter(s => s.status === 'missed' || (s.price_change !== null && s.price_change.direction === 'increase'));
  const summaryAlerts = alertSubs.length;

  return (
    <AppLayout title={t('subscriptions.title')}>
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
                    <p className="text-sm text-muted-foreground">{t('subscriptions.active')}</p>
                    <p className="text-2xl font-bold">{activeSubs.length}</p>
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
                    <p className="text-sm text-muted-foreground">{t('subscriptions.monthlyCost')}</p>
                    <p className="text-2xl font-bold">{formatCurrency(summaryMonthly)}</p>
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
                    <p className="text-sm text-muted-foreground">{t('subscriptions.annualCost')}</p>
                    <p className="text-2xl font-bold">{formatCurrency(summaryAnnual)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-colors ${filterAlerts ? 'ring-2 ring-destructive' : 'hover:bg-muted/50'}`}
              onClick={() => {
                setFilterAlerts(!filterAlerts);
                setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
              }}
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('subscriptions.alerts')}</p>
                    <p className="text-2xl font-bold">{summaryAlerts}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Subscription List */}
          <Card ref={listRef}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{t('subscriptions.detectedSubscriptions')}</CardTitle>
                {filterAlerts && (
                  <Badge variant="destructive" className="cursor-pointer" onClick={() => setFilterAlerts(false)}>
                    {t('subscriptions.alerts')} ✕
                  </Badge>
                )}
              </div>
              <CardTitle className="text-lg">{t('subscriptions.detectedSubscriptions')}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDismissed(!showDismissed)}
                className="text-muted-foreground"
              >
                {showDismissed ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
                {showDismissed ? t('subscriptions.hideDismissed') : t('subscriptions.showDismissed')}
              </Button>
            </CardHeader>
            <CardContent>
              {!visibleSubs.length ? (
                <p className="text-muted-foreground text-center py-8">{t('subscriptions.noSubscriptions')}</p>
              ) : (
                <div className="space-y-3">
                  {visibleSubs.map((sub, i) => {
                    const statusCfg = statusConfig[sub.status];
                    const StatusIcon = statusCfg.icon;
                    return (
                      <div key={i} className={`flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors ${sub.dismissed ? 'opacity-50' : ''}`}>
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
                              <span>{t('subscriptions.next', { date: format(parseISO(sub.next_expected_date), 'MMM d') })}</span>
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
                          <span className="font-semibold tabular-nums">{formatCurrency(sub.amount)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => dismissMutation.mutate({ merchantKey: sub.merchant_key, dismiss: !sub.dismissed })}
                            title={sub.dismissed ? t('subscriptions.restoreSubscription') : t('subscriptions.dismissSubscription')}
                          >
                            {sub.dismissed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
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
