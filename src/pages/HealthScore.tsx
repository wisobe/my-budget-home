import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';
import { useQuery } from '@tanstack/react-query';
import { healthScoreApi } from '@/lib/api';
import { Heart, Lightbulb, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface HealthData {
  score: number;
  grade: string;
  breakdown: { name: string; score: number; max: number; detail: string }[];
  tips: { type: string; text: string }[];
  summary: {
    monthly_income: number;
    monthly_expenses: number;
    savings_rate: number;
    total_debt: number;
    total_assets: number;
  };
}

const gradeColors: Record<string, string> = {
  'A+': 'text-green-600 dark:text-green-400',
  'A': 'text-green-600 dark:text-green-400',
  'B': 'text-blue-600 dark:text-blue-400',
  'C': 'text-orange-600 dark:text-orange-400',
  'D': 'text-orange-700 dark:text-orange-300',
  'F': 'text-destructive',
};

const scoreColor = (score: number) => {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-blue-600 dark:text-blue-400';
  if (score >= 40) return 'text-orange-600 dark:text-orange-400';
  return 'text-destructive';
};

const HealthScore = () => {
  const { t } = useTranslation();
  const { plaidEnvironment: environment } = usePlaidEnvironment();

  const { data, isLoading } = useQuery({
    queryKey: ['health-score', environment],
    queryFn: () => healthScoreApi.get(environment),
  });

  const health = data?.data as HealthData | undefined;

  return (
    <AppLayout title={t('healthScore.title')}>
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      ) : !health ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {t('healthScore.noData')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Score Hero */}
          <Card>
            <CardContent className="flex flex-col items-center py-10">
              <div className="relative h-40 w-40 flex items-center justify-center">
                <svg className="absolute inset-0" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="70" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                  <circle
                    cx="80" cy="80" r="70" fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="10"
                    strokeDasharray={`${(health.score / 100) * 440} 440`}
                    strokeLinecap="round"
                    transform="rotate(-90 80 80)"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="text-center">
                  <p className={`text-4xl font-bold ${scoreColor(health.score)}`}>{health.score}</p>
                  <p className={`text-lg font-semibold ${gradeColors[health.grade] || 'text-foreground'}`}>{health.grade}</p>
                </div>
              </div>
              <p className="mt-4 text-muted-foreground text-sm">{t('healthScore.yourScore')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('healthScore.basedOn3Months')}</p>

              {/* Quick Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 w-full max-w-2xl">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">{t('healthScore.avgMonthlyIncome')}</p>
                  <p className="text-lg font-semibold">${Number(health.summary.monthly_income).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">{t('healthScore.avgMonthlyExpenses')}</p>
                  <p className="text-lg font-semibold">${Number(health.summary.monthly_expenses).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">{t('healthScore.savingsRate')}</p>
                  <p className="text-lg font-semibold">{health.summary.savings_rate}%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">{t('healthScore.debtRatio')}</p>
                  <p className="text-lg font-semibold">
                    {Number(health.summary.total_assets) + Number(health.summary.total_debt) > 0
                      ? ((Number(health.summary.total_debt) / (Number(health.summary.total_assets) + Number(health.summary.total_debt))) * 100).toFixed(1)
                      : '0'}%
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">{t('healthScore.incomeExpensesNote')}</p>
            </CardContent>
          </Card>

          {/* Score Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('healthScore.scoreBreakdown')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {health.breakdown.map((item, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-sm text-muted-foreground">{item.score}/{item.max}</span>
                  </div>
                  <Progress value={(item.score / item.max) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{item.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tips */}
          {health.tips.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  {t('healthScore.tipsTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {health.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-3">
                    {tip.type === 'positive' ? (
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm">{tip.text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </AppLayout>
  );
};

export default HealthScore;
