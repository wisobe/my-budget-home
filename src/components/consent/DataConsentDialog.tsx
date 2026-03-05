import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ShieldCheck } from 'lucide-react';
import { usePreferences } from '@/contexts/PreferencesContext';

export function DataConsentDialog() {
  const { t } = useTranslation();
  const { consentDataCollection, consentDataProcessing, consentDataStorage, setConsentDataCollection, setConsentDataProcessing, setConsentDataStorage, isLoaded } = usePreferences();

  // Show dialog if user hasn't made any consent decision yet (all false and loaded)
  const [dismissed, setDismissed] = useState(false);
  const needsConsent = isLoaded && !consentDataCollection && !consentDataProcessing && !consentDataStorage && !dismissed;

  // Local state for the dialog
  const [localCollection, setLocalCollection] = useState(true);
  const [localProcessing, setLocalProcessing] = useState(true);
  const [localStorage, setLocalStorage] = useState(true);

  const handleSave = () => {
    setConsentDataCollection(localCollection);
    setConsentDataProcessing(localProcessing);
    setConsentDataStorage(localStorage);
    setDismissed(true);
  };

  const handleDeclineAll = () => {
    setConsentDataCollection(false);
    setConsentDataProcessing(false);
    setConsentDataStorage(false);
    setDismissed(true);
  };

  // Check if user already gave consent previously via a stored pref marker
  const hasConsentRecord = usePreferences().consentRecorded;
  if (hasConsentRecord || !needsConsent) return null;

  return (
    <Dialog open={needsConsent} onOpenChange={(open) => { if (!open) setDismissed(true); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{t('consent.dataTitle')}</DialogTitle>
              <DialogDescription>{t('consent.dataDescription')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">{t('consent.dataExplanation')}</p>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{t('consent.collectionTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('consent.collectionDesc')}</p>
            </div>
            <Switch checked={localCollection} onCheckedChange={setLocalCollection} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{t('consent.processingTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('consent.processingDesc')}</p>
            </div>
            <Switch checked={localProcessing} onCheckedChange={setLocalProcessing} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{t('consent.storageTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('consent.storageDesc')}</p>
            </div>
            <Switch checked={localStorage} onCheckedChange={setLocalStorage} />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleDeclineAll} className="w-full sm:w-auto">
            {t('consent.declineAll')}
          </Button>
          <Button onClick={handleSave} className="w-full sm:w-auto">
            {t('consent.savePreferences')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
