import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';

const AdminBackend = () => {
  const { t } = useTranslation();
  const [dbTestStatus, setDbTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dbTestMessage, setDbTestMessage] = useState('');

  const testDatabaseConnection = async () => {
    setDbTestStatus('testing');
    try {
      const apiUrl = `${API_BASE_URL}/settings/test-db.php`;
      const token = sessionStorage.getItem('auth_token');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      const result = await response.json();
      if (result.data?.success) {
        setDbTestStatus('success');
        setDbTestMessage(t('settings.connected', { version: result.data.version }));
      } else {
        setDbTestStatus('error');
        setDbTestMessage(result.data?.message || t('settings.connectionFailed'));
      }
    } catch {
      setDbTestStatus('error');
      setDbTestMessage(t('settings.couldNotReach'));
    }
  };

  return (
    <AppLayout title={t('adminBackend.title')}>
      <div className="space-y-6 max-w-2xl">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              {t('settings.backendSetupGuide')}
            </CardTitle>
            <CardDescription>{t('settings.backendSetupDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <Badge variant="outline" className="shrink-0">1</Badge>
                <div>
                  <p className="font-medium">{t('settings.step1Title')}</p>
                  <p className="text-muted-foreground">{t('settings.step1Desc')}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="shrink-0">2</Badge>
                <div>
                  <p className="font-medium">{t('settings.step2Title')}</p>
                  <p className="text-muted-foreground">{t('settings.step2Desc')}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="shrink-0">3</Badge>
                <div>
                  <p className="font-medium">{t('settings.step3Title')}</p>
                  <p className="text-muted-foreground">{t('settings.step3Desc')}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="shrink-0">4</Badge>
                <div>
                  <p className="font-medium">{t('settings.step4Title')}</p>
                  <p className="text-muted-foreground">{t('settings.step4Desc')}</p>
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>{t('settings.dbConnection')}</Label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={testDatabaseConnection} disabled={dbTestStatus === 'testing'}>
                  {dbTestStatus === 'testing' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {dbTestStatus === 'success' && <CheckCircle2 className="h-4 w-4 mr-2 text-income" />}
                  {dbTestStatus === 'error' && <XCircle className="h-4 w-4 mr-2 text-destructive" />}
                  {t('settings.testConnection')}
                </Button>
                {dbTestMessage && (
                  <p className={`text-sm self-center ${dbTestStatus === 'success' ? 'text-income' : 'text-destructive'}`}>{dbTestMessage}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminBackend;
