import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SecurityPolicy = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const sections = [
    { title: t('securityPolicy.section1Title'), content: t('securityPolicy.section1Content') },
    { title: t('securityPolicy.section2Title'), content: t('securityPolicy.section2Content') },
    { title: t('securityPolicy.section3Title'), content: t('securityPolicy.section3Content') },
    { title: t('securityPolicy.section4Title'), content: t('securityPolicy.section4Content') },
    { title: t('securityPolicy.section5Title'), content: t('securityPolicy.section5Content') },
    { title: t('securityPolicy.section6Title'), content: t('securityPolicy.section6Content') },
    { title: t('securityPolicy.section7Title'), content: t('securityPolicy.section7Content') },
    { title: t('securityPolicy.section8Title'), content: t('securityPolicy.section8Content') },
    { title: t('securityPolicy.section9Title'), content: t('securityPolicy.section9Content') },
    { title: t('securityPolicy.section10Title'), content: t('securityPolicy.section10Content') },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('securityPolicy.back')}
        </Button>

        <Card>
          <CardContent className="pt-6">
            <h1 className="text-2xl font-bold mb-2">{t('securityPolicy.title')}</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {t('securityPolicy.lastUpdated', { date: '2026-03-08' })}
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
                {t('securityPolicy.contact')}
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

export default SecurityPolicy;
