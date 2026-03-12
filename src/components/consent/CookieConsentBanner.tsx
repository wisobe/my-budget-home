import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Cookie, ShieldCheck, ShieldAlert } from 'lucide-react';

export type CookieConsentLevel = 'accepted' | 'essential' | 'declined' | null;

export function getCookieConsent(): CookieConsentLevel {
  return localStorage.getItem('cookie_consent') as CookieConsentLevel;
}

export function CookieConsentBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const setConsent = (level: CookieConsentLevel) => {
    localStorage.setItem('cookie_consent', level!);
    setVisible(false);
    window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: level }));
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="mx-auto max-w-3xl rounded-lg border bg-card shadow-lg p-4 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <Cookie className="h-6 w-6 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{t('consent.cookieTitle')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('consent.cookieDescription')}</p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-start gap-2 rounded-md border p-3 bg-muted/30">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium">{t('consent.cookieEssentialTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('consent.cookieEssentialDesc')}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-md border p-3 bg-muted/30">
            <ShieldAlert className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium">{t('consent.cookieNonEssentialTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('consent.cookieNonEssentialDesc')}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button variant="destructive" size="sm" onClick={() => setConsent('declined')} className="flex-1 sm:flex-none min-h-[44px]">
            {t('consent.declineAll')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConsent('essential')} className="flex-1 sm:flex-none min-h-[44px]">
            {t('consent.essentialOnly')}
          </Button>
          <Button size="sm" onClick={() => setConsent('accepted')} className="flex-1 sm:flex-none min-h-[44px]">
            {t('consent.acceptAll')}
          </Button>
        </div>
      </div>
    </div>
  );
}
