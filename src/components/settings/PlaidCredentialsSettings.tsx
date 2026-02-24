import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle2, Key, Eye, EyeOff, Save } from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';
import { toast } from '@/components/ui/sonner';

interface PlaidEnvCredentials {
  client_id: string;
  secret: string;
  country_codes: string;
  products: string;
  has_credentials: boolean;
}

interface CredentialsData {
  sandbox: PlaidEnvCredentials;
  production: PlaidEnvCredentials;
}

export function PlaidCredentialsSettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialsData | null>(null);

  // Form state
  const [sandboxClientId, setSandboxClientId] = useState('');
  const [sandboxSecret, setSandboxSecret] = useState('');
  const [sandboxCountryCodes, setSandboxCountryCodes] = useState('CA');
  const [sandboxProducts, setSandboxProducts] = useState('transactions');
  const [prodClientId, setProdClientId] = useState('');
  const [prodSecret, setProdSecret] = useState('');
  const [prodCountryCodes, setProdCountryCodes] = useState('CA');
  const [prodProducts, setProdProducts] = useState('transactions');
  // Show/hide secrets
  const [showSandboxSecret, setShowSandboxSecret] = useState(false);
  const [showProdSecret, setShowProdSecret] = useState(false);

  const token = sessionStorage.getItem('auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/settings/credentials.php`, { headers });
      const result = await res.json();
      if (result.success && result.data) {
        setCredentials(result.data);
        setSandboxClientId(result.data.sandbox.client_id || '');
        setSandboxSecret('');
        setSandboxCountryCodes(result.data.sandbox.country_codes || 'CA');
        setSandboxProducts(result.data.sandbox.products || 'transactions');
        setProdClientId(result.data.production.client_id || '');
        setProdSecret('');
        setProdCountryCodes(result.data.production.country_codes || 'CA');
        setProdProducts(result.data.production.products || 'transactions');
      }
    } catch {
      // Ignore fetch errors
    } finally {
      setLoading(false);
    }
  };

  const saveCredentials = async (environment: 'sandbox' | 'production') => {
    const clientId = environment === 'sandbox' ? sandboxClientId : prodClientId;
    const secret = environment === 'sandbox' ? sandboxSecret : prodSecret;
    const countryCodes = environment === 'sandbox' ? sandboxCountryCodes : prodCountryCodes;
    const products = environment === 'sandbox' ? sandboxProducts : prodProducts;

    if (!clientId.trim() || !secret.trim()) {
      toast.error(t('plaidCredentials.bothRequired'));
      return;
    }

    setSaving(environment);
    try {
      const res = await fetch(`${API_BASE_URL}/settings/credentials.php`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ environment, client_id: clientId.trim(), secret: secret.trim(), country_codes: countryCodes.trim(), products: products.trim() }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(t('plaidCredentials.saved', { env: environment }));
        // Re-fetch to get masked values
        await fetchCredentials();
      } else {
        toast.error(result.message || t('plaidCredentials.failedSave'));
      }
    } catch {
      toast.error(t('plaidCredentials.failedSave'));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const renderEnvForm = (env: 'sandbox' | 'production') => {
    const isSandbox = env === 'sandbox';
    const clientId = isSandbox ? sandboxClientId : prodClientId;
    const setClientId = isSandbox ? setSandboxClientId : setProdClientId;
    const secret = isSandbox ? sandboxSecret : prodSecret;
    const setSecret = isSandbox ? setSandboxSecret : setProdSecret;
    const showSecret = isSandbox ? showSandboxSecret : showProdSecret;
    const toggleSecret = isSandbox ? setShowSandboxSecret : setShowProdSecret;
    const countryCodes = isSandbox ? sandboxCountryCodes : prodCountryCodes;
    const setCountryCodes = isSandbox ? setSandboxCountryCodes : setProdCountryCodes;
    const products = isSandbox ? sandboxProducts : prodProducts;
    const setProducts = isSandbox ? setSandboxProducts : setProdProducts;
    const hasExisting = credentials?.[env]?.has_credentials;
    const maskedSecret = credentials?.[env]?.secret || '';

    return (
      <div className="space-y-4">
        {hasExisting && (
          <div className="flex items-center gap-2 text-sm text-income">
            <CheckCircle2 className="h-4 w-4" />
            {t('plaidCredentials.configured')}
          </div>
        )}
        <div className="space-y-2">
          <Label>{t('plaidCredentials.clientId')}</Label>
          <Input
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder={t('plaidCredentials.clientIdPlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('plaidCredentials.secret')}</Label>
          <div className="relative">
            <Input
              type={showSecret ? 'text' : 'password'}
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder={hasExisting ? maskedSecret : t('plaidCredentials.secretPlaceholder')}
            />
            <button
              type="button"
              onClick={() => toggleSecret(!showSecret)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {hasExisting && (
            <p className="text-xs text-muted-foreground">{t('plaidCredentials.leaveBlankHint')}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('plaidCredentials.countryCodes')}</Label>
            <Input
              value={countryCodes}
              onChange={e => setCountryCodes(e.target.value)}
              placeholder={t('plaidCredentials.countryCodesPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{t('plaidCredentials.countryCodesHint')}</p>
          </div>
          <div className="space-y-2">
            <Label>{t('plaidCredentials.products')}</Label>
            <Input
              value={products}
              onChange={e => setProducts(e.target.value)}
              placeholder={t('plaidCredentials.productsPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{t('plaidCredentials.productsHint')}</p>
          </div>
        </div>
        <Button
          onClick={() => saveCredentials(env)}
          disabled={saving === env || !clientId.trim() || !secret.trim()}
        >
          {saving === env ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {t('plaidCredentials.saveCredentials')}
        </Button>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          {t('plaidCredentials.title')}
          <Badge variant="outline" className="text-xs">{t('settings.admin')}</Badge>
        </CardTitle>
        <CardDescription>{t('plaidCredentials.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sandbox">
          <TabsList className="mb-4">
            <TabsTrigger value="sandbox">
              {t('settings.sandboxLabel')}
              {credentials?.sandbox?.has_credentials && (
                <CheckCircle2 className="h-3 w-3 ml-1.5 text-income" />
              )}
            </TabsTrigger>
            <TabsTrigger value="production">
              {t('settings.productionLabel')}
              {credentials?.production?.has_credentials && (
                <CheckCircle2 className="h-3 w-3 ml-1.5 text-income" />
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sandbox">{renderEnvForm('sandbox')}</TabsContent>
          <TabsContent value="production">{renderEnvForm('production')}</TabsContent>
        </Tabs>
        <p className="text-xs text-muted-foreground mt-4">
          {t('plaidCredentials.getKeysHint')}{' '}
          <a href="https://dashboard.plaid.com/developers/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {t('settings.plaidDashboard')}
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
