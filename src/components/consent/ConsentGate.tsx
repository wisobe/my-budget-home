import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ConsentGateProps {
  type: 'collection' | 'processing';
}

export function ConsentGate({ type }: ConsentGateProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-6">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">
          {t(`consent.gate.${type}Title`)}
        </h2>
        <p className="text-muted-foreground max-w-md mb-6">
          {t(`consent.gate.${type}Description`)}
        </p>
        <Button onClick={() => navigate('/settings')}>
          {t('consent.gate.goToSettings')}
        </Button>
      </CardContent>
    </Card>
  );
}
