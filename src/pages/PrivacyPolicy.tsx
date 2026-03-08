import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const sections = [
    { title: t('privacy.section1Title'), content: t('privacy.section1Content') },
    { title: t('privacy.section2Title'), content: t('privacy.section2Content') },
    { title: t('privacy.section3Title'), content: t('privacy.section3Content') },
    { title: t('privacy.section4Title'), content: t('privacy.section4Content') },
    { title: t('privacy.section5Title'), content: t('privacy.section5Content') },
    { title: t('privacy.section6Title'), content: t('privacy.section6Content') },
    { title: t('privacy.section7Title'), content: t('privacy.section7Content') },
    { title: t('privacy.section8Title'), content: t('privacy.section8Content') },
    { title: t('privacy.section9Title'), content: t('privacy.section9Content') },
    { title: t('privacy.section10Title'), content: t('privacy.section10Content') },
    { title: t('privacy.section11Title'), content: t('privacy.section11Content') },
    { title: t('privacy.section12Title'), content: t('privacy.section12Content') },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('privacy.back')}
        </Button>

        <Card>
          <CardContent className="pt-6">
            <h1 className="text-2xl font-bold mb-2">{t('privacy.title')}</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {t('privacy.lastUpdated', { date: '2026-03-08' })}
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
                {t('privacy.contact')}
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

export default PrivacyPolicy;
