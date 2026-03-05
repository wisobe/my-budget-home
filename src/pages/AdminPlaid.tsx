import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Key, FlaskConical, Building2 } from 'lucide-react';
import { PlaidCredentialsSettings } from '@/components/settings/PlaidCredentialsSettings';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';
import { cn } from '@/lib/utils';

const AdminPlaid = () => {
  const { t } = useTranslation();
  const { plaidEnvironment, setPlaidEnvironment, canUseSandbox } = usePlaidEnvironment();

  return (
    <AppLayout title={t('adminPlaid.title')}>
      <div className="space-y-6 max-w-2xl">
        <PlaidCredentialsSettings />

        {canUseSandbox && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                {t('settings.plaidEnvironment')}
              </CardTitle>
              <CardDescription>{t('settings.plaidEnvDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>{t('settings.activeEnvironment')}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPlaidEnvironment('sandbox')}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left",
                      plaidEnvironment === 'sandbox' ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <FlaskConical className={cn("h-5 w-5", plaidEnvironment === 'sandbox' ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <p className="font-medium">{t('settings.sandboxLabel')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.sandboxDesc')}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setPlaidEnvironment('production')}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left",
                      plaidEnvironment === 'production' ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <Building2 className={cn("h-5 w-5", plaidEnvironment === 'production' ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <p className="font-medium">{t('settings.productionLabel')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.productionDesc')}</p>
                    </div>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{t('settings.envSeparate')}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminPlaid;
