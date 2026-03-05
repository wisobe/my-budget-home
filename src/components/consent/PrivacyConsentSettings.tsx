import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ShieldCheck } from 'lucide-react';
import { usePreferences } from '@/contexts/PreferencesContext';

export function PrivacyConsentSettings() {
  const { t } = useTranslation();
  const {
    consentDataCollection, setConsentDataCollection,
    consentDataProcessing, setConsentDataProcessing,
    consentDataStorage, setConsentDataStorage,
  } = usePreferences();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          {t('consent.privacyTitle')}
        </CardTitle>
        <CardDescription>{t('consent.privacyDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{t('consent.collectionTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('consent.collectionDesc')}</p>
          </div>
          <Switch checked={consentDataCollection} onCheckedChange={setConsentDataCollection} />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{t('consent.processingTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('consent.processingDesc')}</p>
          </div>
          <Switch checked={consentDataProcessing} onCheckedChange={setConsentDataProcessing} />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{t('consent.storageTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('consent.storageDesc')}</p>
          </div>
          <Switch checked={consentDataStorage} onCheckedChange={setConsentDataStorage} />
        </div>
      </CardContent>
    </Card>
  );
}
