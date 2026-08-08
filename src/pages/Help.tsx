import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, HelpCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface HelpItem {
  q: string;
  a: string;
}

interface HelpSection {
  id: string;
  title: string;
  desc: string;
  items: HelpItem[];
}

const Help = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const sections = (t('help.sections', { returnObjects: true }) as HelpSection[]) || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.q.toLowerCase().includes(q) ||
            item.a.toLowerCase().includes(q) ||
            section.title.toLowerCase().includes(q),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [query, sections]);

  const openValues = query.trim()
    ? filtered.flatMap((s) => s.items.map((_, i) => `${s.id}-${i}`))
    : undefined;

  return (
    <AppLayout title={t('help.title')}>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <HelpCircle className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">{t('help.subtitle')}</p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('help.searchPlaceholder')}
              className="pl-9 pr-9"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setQuery('')}
                aria-label={t('help.clearSearch')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {!query && (
            <nav className="flex flex-wrap gap-2">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#help-${section.id}`}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          )}
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t('help.noResults')}
            </CardContent>
          </Card>
        ) : (
          filtered.map((section) => (
            <Card key={section.id} id={`help-${section.id}`} className="scroll-mt-24">
              <CardHeader>
                <CardTitle className="text-base">{section.title}</CardTitle>
                <CardDescription>{section.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion
                  key={query ? 'search' : 'browse'}
                  type="multiple"
                  defaultValue={openValues}
                  className="w-full"
                >
                  {section.items.map((item, index) => (
                    <AccordionItem key={`${section.id}-${index}`} value={`${section.id}-${index}`}>
                      <AccordionTrigger className="text-left text-sm font-medium">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))
        )}

        <p className="pb-4 text-center text-xs text-muted-foreground">{t('help.footer')}</p>
      </div>
    </AppLayout>
  );
};

export default Help;
