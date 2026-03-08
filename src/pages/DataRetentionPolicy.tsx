import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DataRetentionPolicy = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const sections = Array.from({ length: 10 }, (_, i) => ({
    title: t(`dataRetentionPolicy.section${i + 1}Title`),
    content: t(`dataRetentionPolicy.section${i + 1}Content`),
  }));

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('dataRetentionPolicy.back')}
        </Button>

        <Card>
          <CardContent className="pt-6">
            <h1 className="text-2xl font-bold mb-2">{t('dataRetentionPolicy.title')}</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {t('dataRetentionPolicy.lastUpdated', { date: '2026-03-08' })}
            </p>

            <div className="space-y-6">
              {sections.map((section, i) => (
                <div key={i}>
                  <h2 className="text-lg font-semibold mb-2">{`${i + 1}. ${section.title}`}</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                    {section.content}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground">
                {t('dataRetentionPolicy.contact')}
              </p>
              <p className="text-sm font-medium mt-2">
                BudgetWise<br />
                1234 rue de l'Église, Lévis (QC) H0H0H0<br />
                budgetwise@guisset.ca
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DataRetentionPolicy;
