import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';
import { useQuery } from '@tanstack/react-query';
import { healthScoreApi, subscriptionsApi } from '@/lib/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calculator, TrendingUp, Minus, Plus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const Simulator = () => {
  const { t } = useTranslation();
  const { plaidEnvironment: environment } = usePlaidEnvironment();

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['health-score', environment],
    queryFn: () => healthScoreApi.get(environment),
  });

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ['subscriptions', environment],
    queryFn: () => subscriptionsApi.list(environment),
  });

  const summary = healthData?.data?.summary;
  const subscriptions = useMemo(() => {
    const all = subData?.data?.subscriptions ?? [];
    return all.filter((s: any) => !s.dismissed);
  }, [subData]);

  const [spendingAdjust, setSpendingAdjust] = useState(0); // % change
  const [extraSavings, setExtraSavings] = useState(0);
  const [cancelledSubs, setCancelledSubs] = useState<Set<number>>(new Set());

  const cancelledSavings = useMemo(() => {
    let total = 0;
    cancelledSubs.forEach(i => {
      if (subscriptions[i]) total += subscriptions[i].monthly_cost;
    });
    return total;
  }, [cancelledSubs, subscriptions]);

  const projections = useMemo(() => {
    if (!summary) return [];

    const monthlyIncome = summary.monthly_income;
    const baseExpenses = summary.monthly_expenses;
    const adjustedExpenses = baseExpenses * (1 + spendingAdjust / 100) - cancelledSavings;
    const monthlySavings = monthlyIncome - adjustedExpenses + extraSavings;

    const startingBalance = summary.total_assets - summary.total_debt;
    const points = [];
    const months = [0, 1, 3, 6, 12, 24, 36, 60, 120];

    for (const m of months) {
      const projected = startingBalance + monthlySavings * m;
      const baseline = startingBalance + (monthlyIncome - baseExpenses) * m;
      let label = 'Today';
      if (m === 1) label = '1 mo';
      else if (m === 3) label = '3 mo';
      else if (m === 6) label = '6 mo';
      else if (m === 12) label = '1 yr';
      else if (m === 24) label = '2 yr';
      else if (m === 36) label = '3 yr';
      else if (m === 60) label = '5 yr';
      else if (m === 120) label = '10 yr';

      points.push({
        label,
        months: m,
        projected: Math.round(projected),
        baseline: Math.round(baseline),
      });
    }
    return points;
  }, [summary, spendingAdjust, extraSavings, cancelledSavings]);

  const isLoading = healthLoading || subLoading;

  const monthlySavingsDiff = useMemo(() => {
    if (!summary) return 0;
    const baseExpenses = summary.monthly_expenses;
    const adjustedExpenses = baseExpenses * (1 + spendingAdjust / 100) - cancelledSavings;
    return -(adjustedExpenses - baseExpenses) + extraSavings;
  }, [summary, spendingAdjust, cancelledSavings, extraSavings]);

  return (
    <AppLayout title={t('simulator.title', 'Financial Simulator')}>
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      ) : !summary ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Not enough data to run simulations. Add more transactions first.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Impact Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">Monthly Impact</p>
                <p className={`text-2xl font-bold ${monthlySavingsDiff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                  {monthlySavingsDiff >= 0 ? '+' : ''}{monthlySavingsDiff.toFixed(0)}/mo
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">1-Year Impact</p>
                <p className={`text-2xl font-bold ${monthlySavingsDiff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                  ${(monthlySavingsDiff * 12).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">Subscriptions Cancelled</p>
                <p className="text-2xl font-bold">{cancelledSubs.size}</p>
              </CardContent>
            </Card>
          </div>

          {/* Projection Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Projected Net Worth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projections}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" className="text-xs" />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} className="text-xs" />
                    <Tooltip
                      formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Area
                      type="monotone" dataKey="baseline" name="Current Path"
                      stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted))" strokeDasharray="5 5" fillOpacity={0.3}
                    />
                    <Area
                      type="monotone" dataKey="projected" name="Simulated"
                      stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-6 justify-center mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-muted-foreground" style={{ borderTop: '2px dashed' }} />
                  <span className="text-muted-foreground">Current path</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-primary" />
                  <span className="text-muted-foreground">Simulated</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Spending Adjustment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Spending Adjustment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label>Overall Spending</Label>
                    <Badge variant={spendingAdjust < 0 ? 'default' : spendingAdjust > 0 ? 'destructive' : 'secondary'}>
                      {spendingAdjust > 0 ? '+' : ''}{spendingAdjust}%
                    </Badge>
                  </div>
                  <Slider
                    value={[spendingAdjust]}
                    onValueChange={([v]) => setSpendingAdjust(v)}
                    min={-50} max={50} step={5}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>-50%</span><span>0%</span><span>+50%</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label>Extra Monthly Savings</Label>
                    <Badge variant="secondary">${extraSavings}</Badge>
                  </div>
                  <Slider
                    value={[extraSavings]}
                    onValueChange={([v]) => setExtraSavings(v)}
                    min={0} max={2000} step={50}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>$0</span><span>$1,000</span><span>$2,000</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cancel Subscriptions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cancel Subscriptions</CardTitle>
              </CardHeader>
              <CardContent>
                {subscriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No subscriptions detected</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {subscriptions.map((sub: any, i: number) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <Switch
                            checked={cancelledSubs.has(i)}
                            onCheckedChange={(checked) => {
                              setCancelledSubs(prev => {
                                const next = new Set(prev);
                                if (checked) next.add(i); else next.delete(i);
                                return next;
                              });
                            }}
                          />
                          <span className={`text-sm truncate ${cancelledSubs.has(i) ? 'line-through text-muted-foreground' : ''}`}>
                            {sub.merchant}
                          </span>
                        </div>
                        <span className="text-sm font-medium tabular-nums shrink-0">${sub.monthly_cost.toFixed(2)}/mo</span>
                      </div>
                    ))}
                  </div>
                )}
                {cancelledSavings > 0 && (
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-sm font-medium">Total saved</span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">${cancelledSavings.toFixed(2)}/mo</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default Simulator;
