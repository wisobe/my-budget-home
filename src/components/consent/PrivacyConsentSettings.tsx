import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { usePreferences } from '@/contexts/PreferencesContext';
import { DeleteDataDialog } from '@/components/consent/DeleteDataDialog';

export function PrivacyConsentSettings() {
  const { t } = useTranslation();
  const {
    consentDataCollection, setConsentDataCollection,
    consentDataProcessing, setConsentDataProcessing,
    consentDataStorage, setConsentDataStorage,
  } = usePreferences();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleStorageToggle = (checked: boolean) => {
    if (!checked) {
      // When turning off storage, prompt for data deletion
      setDeleteDialogOpen(true);
    } else {
      setConsentDataStorage(true);
    }
  };

  return (
    <>
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
              {!consentDataCollection && (
                <p className="text-xs text-destructive mt-1">{t('consent.gate.collectionHint')}</p>
              )}
            </div>
            <Switch checked={consentDataCollection} onCheckedChange={setConsentDataCollection} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('consent.processingTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('consent.processingDesc')}</p>
              {!consentDataProcessing && (
                <p className="text-xs text-destructive mt-1">{t('consent.gate.processingHint')}</p>
              )}
            </div>
            <Switch checked={consentDataProcessing} onCheckedChange={setConsentDataProcessing} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('consent.storageTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('consent.storageDesc')}</p>
              {!consentDataStorage && (
                <p className="text-xs text-destructive mt-1">{t('consent.gate.storageHint')}</p>
              )}
            </div>
            <Switch checked={consentDataStorage} onCheckedChange={handleStorageToggle} />
          </div>

          {consentDataStorage === false && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-destructive">{t('consent.deleteData.manualTitle')}</p>
                  <p className="text-sm text-muted-foreground">{t('consent.deleteData.manualDesc')}</p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('consent.deleteData.button')}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <DeleteDataDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} />
    </>
  );
}
