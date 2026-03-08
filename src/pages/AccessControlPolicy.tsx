import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AccessControlPolicy = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const sections = [
    { title: t('accessControlPolicy.section1Title'), content: t('accessControlPolicy.section1Content') },
    { title: t('accessControlPolicy.section2Title'), content: t('accessControlPolicy.section2Content') },
    { title: t('accessControlPolicy.section3Title'), content: t('accessControlPolicy.section3Content') },
    { title: t('accessControlPolicy.section4Title'), content: t('accessControlPolicy.section4Content') },
    { title: t('accessControlPolicy.section5Title'), content: t('accessControlPolicy.section5Content') },
    { title: t('accessControlPolicy.section6Title'), content: t('accessControlPolicy.section6Content') },
    { title: t('accessControlPolicy.section7Title'), content: t('accessControlPolicy.section7Content') },
    { title: t('accessControlPolicy.section8Title'), content: t('accessControlPolicy.section8Content') },
    { title: t('accessControlPolicy.section9Title'), content: t('accessControlPolicy.section9Content') },
    { title: t('accessControlPolicy.section10Title'), content: t('accessControlPolicy.section10Content') },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('accessControlPolicy.back')}
        </Button>

        <Card>
          <CardContent className="pt-6">
            <h1 className="text-2xl font-bold mb-2">{t('accessControlPolicy.title')}</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {t('accessControlPolicy.lastUpdated', { date: '2026-03-08' })}
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
                {t('accessControlPolicy.contact')}
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

export default AccessControlPolicy;
