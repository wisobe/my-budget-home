import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';
import { useQuery } from '@tanstack/react-query';
import { insightsApi } from '@/lib/api';
import { AlertTriangle, TrendingUp, TrendingDown, ShieldAlert, Copy, Banknote, Info, Lightbulb } from 'lucide-react';

interface Insight {
  type: string;
  severity: 'critical' | 'warning' | 'positive' | 'info';
  title: string;
  description: string;
  data: Record<string, unknown>;
}

const severityConfig = {
  critical: { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30', icon: ShieldAlert },
  warning: { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: AlertTriangle },
  positive: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', icon: TrendingUp },
  info: { color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30', icon: Info },
};

const typeIcons: Record<string, typeof AlertTriangle> = {
  unusual_merchant: ShieldAlert,
  salary_change: Banknote,
  spending_spike: TrendingUp,
  duplicate_charge: Copy,
  large_transaction: Banknote,
};

const Insights = () => {
  const { t } = useTranslation();
  const { plaidEnvironment: environment } = usePlaidEnvironment();

  const { data, isLoading } = useQuery({
    queryKey: ['insights', environment],
    queryFn: () => insightsApi.list(environment),
  });

  const insights: Insight[] = data?.data ?? [];

  return (
    <AppLayout title={t('insights.title')}>
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : insights.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground">{t('insights.noInsightsTitle')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('insights.noInsightsDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('insights.insightCount', { count: insights.length })}
          </p>
          {insights.map((insight, i) => {
            const config = severityConfig[insight.severity];
            const Icon = typeIcons[insight.type] || config.icon;
            const data = insight.data as Record<string, string | number>;
            
            // Build translated title and description
            let translatedTitle = insight.title;
            let translatedDesc = insight.description;
            
            if (insight.type === 'unusual_merchant') {
              translatedTitle = t('insights.unusual_merchant_title');
              translatedDesc = t('insights.unusual_merchant_desc', { merchant: data.merchant, amount: data.amount, date: data.date });
            } else if (insight.type === 'salary_change') {
              const direction = data.direction as string;
              translatedTitle = t(`insights.salary_change_${direction}_title`);
              translatedDesc = t('insights.salary_change_desc', {
                source: data.source,
                direction: t(`insights.salary_change_${direction}`),
                percent: data.change_percent,
                previous: data.previous,
                current: data.current,
              });
            } else if (insight.type === 'spending_spike') {
              translatedTitle = t('insights.spending_spike_title', { category: data.category });
              translatedDesc = t('insights.spending_spike_desc', { recent: data.recent, category: data.category, percent: data.spike_percent, average: data.average });
            } else if (insight.type === 'duplicate_charge') {
              translatedTitle = t('insights.duplicate_charge_title');
              translatedDesc = t('insights.duplicate_charge_desc', { count: Number(data.count), amount: String(data.amount), merchant: String(data.merchant), date: String(data.date) });
            } else if (insight.type === 'large_transaction') {
              translatedTitle = t('insights.large_transaction_title');
              translatedDesc = t('insights.large_transaction_desc', { amount: data.amount, merchant: data.merchant, date: data.date });
            }

            return (
              <Card key={i} className={`border ${config.border}`}>
                <CardContent className="flex items-start gap-4 py-4">
                  <div className={`h-10 w-10 rounded-lg ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`font-semibold ${config.color}`}>{translatedTitle}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{translatedDesc}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};

export default Insights;
