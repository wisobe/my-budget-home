import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t('settings.dbConnection')}
            </CardTitle>
            <CardDescription>{t('adminBackend.dbDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminBackend;
