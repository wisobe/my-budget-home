import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FlaskConical, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnvironmentSelectorProps {
  open: boolean;
  onSelect: (env: 'sandbox' | 'production') => void;
}

export function EnvironmentSelector({ open, onSelect }: EnvironmentSelectorProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('environment.selectTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('environment.selectDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 mt-2">
          <Button
            variant="outline"
            className={cn("h-auto p-4 flex items-start gap-3 justify-start text-left")}
            onClick={() => onSelect('sandbox')}
          >
            <FlaskConical className="h-5 w-5 mt-0.5 text-amber-500 shrink-0" />
            <div>
              <div className="font-medium">{t('settings.sandboxLabel')}</div>
              <div className="text-sm text-muted-foreground">{t('settings.sandboxDesc')}</div>
            </div>
          </Button>
          <Button
            variant="outline"
            className={cn("h-auto p-4 flex items-start gap-3 justify-start text-left")}
            onClick={() => onSelect('production')}
          >
            <Building2 className="h-5 w-5 mt-0.5 text-primary shrink-0" />
            <div>
              <div className="font-medium">{t('settings.productionLabel')}</div>
              <div className="text-sm text-muted-foreground">{t('settings.productionDesc')}</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
