import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ShieldX, Cookie } from 'lucide-react';

interface CookieDeclinedScreenProps {
  onAcceptEssential: () => void;
  onAcceptAll: () => void;
}

export function CookieDeclinedScreen({ onAcceptEssential, onAcceptAll }: CookieDeclinedScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">{t('consent.cookieDeclinedTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('consent.cookieDeclinedDescription')}</p>
        </div>

        <div className="rounded-lg border bg-card p-4 text-left space-y-3">
          <div className="flex items-start gap-2">
            <Cookie className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">{t('consent.cookieDeclinedExplanation')}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={onAcceptEssential} variant="outline">
            {t('consent.essentialOnly')}
          </Button>
          <Button onClick={onAcceptAll}>
            {t('consent.acceptAll')}
          </Button>
        </div>
      </div>
    </div>
  );
}
