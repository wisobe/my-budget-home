import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Cookie } from 'lucide-react';

export function CookieConsentBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem('cookie_consent', 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="mx-auto max-w-3xl rounded-lg border bg-card shadow-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Cookie className="h-6 w-6 text-primary shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{t('consent.cookieTitle')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('consent.cookieDescription')}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={decline} className="flex-1 sm:flex-none">
              {t('consent.decline')}
            </Button>
            <Button size="sm" onClick={accept} className="flex-1 sm:flex-none">
              {t('consent.accept')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
