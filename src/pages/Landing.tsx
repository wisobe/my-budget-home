import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Wallet, Globe, ArrowRight, Landmark, PieChart, Repeat, Lightbulb,
  HeartPulse, Calculator, ShieldCheck, Languages, FileSpreadsheet, Coins,
} from 'lucide-react';
// Screenshots live in public/screenshots/ so they can be replaced on the server at any time.
const shot = (name: string) => `${import.meta.env.BASE_URL}screenshots/${name}`;


const Landing = () => {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const next = i18n.language === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(next);
    try { localStorage.setItem('login_language', next); } catch { /* ignore */ }
  };

  const features = [
    { icon: Landmark, key: 'connect' },
    { icon: PieChart, key: 'budgets' },
    { icon: Repeat, key: 'subscriptions' },
    { icon: Lightbulb, key: 'insights' },
    { icon: HeartPulse, key: 'health' },
    { icon: Calculator, key: 'simulator' },
    { icon: Coins, key: 'currency' },
    { icon: FileSpreadsheet, key: 'import' },
    { icon: ShieldCheck, key: 'security' },
  ] as const;

  const showcases = [
    { img: shot('budgetwise_reports_insights.png'), key: 'reportsOverview' },
    { img: shot('budgetwise_transactions.png'), key: 'transactions' },
    { img: shot('budgetwise_budget.png'), key: 'budgets' },
    { img: shot('budgetwise_category_breakdown.png'), key: 'reports' },
    { img: shot('budgetwise_subscriptions.png'), key: 'subscriptions' },
    { img: shot('budgetwise_insights.png'), key: 'insights' },
    { img: shot('budgetwise_financial_health.png'), key: 'health' },
    { img: shot('budgetwise_score_breakdown.png'), key: 'scoreBreakdown' },
    { img: shot('budgetwise_financial_simulator.png'), key: 'simulator' },
    { img: shot('budgetwise_accounts.png'), key: 'accounts' },
    { img: shot('budgetwise_settings.png'), key: 'settings' },
  ];

  const gallery = [
    { img: shot('budgetwise_net_savings_by_month.png'), key: 'netSavings' },
    { img: shot('budgetwise_savings_rate_trend.png'), key: 'savingsRate' },
    { img: shot('budgetwise_spending_by_category.png'), key: 'spending' },
    { img: shot('budgetwise_tips_and_recommendations.png'), key: 'tips' },
  ];



  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-base font-semibold">BudgetWise</p>
              <p className="text-xs text-muted-foreground">{t('landing.tagline')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleLanguage}>
              <Languages className="mr-2 h-4 w-4" />
              {i18n.language === 'fr' ? 'EN' : 'FR'}
            </Button>
            <Button asChild size="sm">
              <Link to="/login">{t('landing.signIn')}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.14),transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Globe className="h-3.5 w-3.5 text-primary" />
            {t('landing.hero.badge')}
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            {t('landing.hero.title')}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            {t('landing.hero.subtitle')}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/login">
                {t('landing.hero.cta')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#features">{t('landing.hero.secondary')}</a>
            </Button>
          </div>

          <div className="mx-auto mt-14 max-w-5xl overflow-hidden rounded-2xl border bg-card shadow-2xl">
            <img
              src={shot('budgetwise_dashboard.png')}
              alt={t('landing.showcase.dashboard.alt')}
              className="w-full"
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('landing.features.title')}</h2>
          <p className="mt-4 text-muted-foreground">{t('landing.features.subtitle')}</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, key }) => (
            <div key={key} className="rounded-2xl border bg-card p-6 transition-shadow hover:shadow-lg">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{t(`landing.features.items.${key}.title`)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t(`landing.features.items.${key}.description`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Showcase */}
      <section className="border-y bg-secondary/40">
        <div className="mx-auto max-w-6xl space-y-20 px-6 py-20">
          {showcases.map((item, index) => (
            <div
              key={item.key}
              className={`grid items-center gap-10 lg:grid-cols-2 ${index % 2 === 1 ? 'lg:[&>div:first-child]:order-2' : ''}`}
            >
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                  {t(`landing.showcase.${item.key}.eyebrow`)}
                </p>
                <h3 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                  {t(`landing.showcase.${item.key}.title`)}
                </h3>
                <p className="mt-4 text-muted-foreground">
                  {t(`landing.showcase.${item.key}.description`)}
                </p>
              </div>
              <div className="overflow-hidden rounded-2xl border bg-card shadow-xl">
                <img
                  src={item.img}
                  alt={t(`landing.showcase.${item.key}.alt`)}
                  className="w-full"
                  loading="lazy"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Gallery */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('landing.gallery.title')}</h2>
          <p className="mt-4 text-muted-foreground">{t('landing.gallery.subtitle')}</p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {gallery.map((item) => (
            <div key={item.key} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <img
                src={item.img}
                alt={t(`landing.gallery.items.${item.key}.alt`)}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </section>


      {/* Savings CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="overflow-hidden rounded-3xl border bg-card">
          <div className="grid items-center gap-8 p-8 lg:grid-cols-2 lg:p-12">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">{t('landing.cta.title')}</h2>
              <p className="mt-4 text-muted-foreground">{t('landing.cta.subtitle')}</p>
              <Button asChild size="lg" className="mt-8">
                <Link to="/login">
                  {t('landing.cta.button')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="overflow-hidden rounded-2xl border shadow-lg">
              <img src={shot('budgetwise_cumulative_savings.png')} alt={t('landing.showcase.savings.alt')} className="w-full" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} BudgetWise</p>
          <nav className="flex flex-wrap items-center gap-4">
            <Link to="/privacy" className="hover:text-foreground">{t('landing.footer.privacy')}</Link>
            <Link to="/security-policy" className="hover:text-foreground">{t('landing.footer.security')}</Link>
            <Link to="/login" className="hover:text-foreground">{t('landing.signIn')}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
