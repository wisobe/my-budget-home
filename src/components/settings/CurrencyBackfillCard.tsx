import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Globe } from 'lucide-react';
import { useBackfillCurrency } from '@/hooks/use-transactions';
import { toast } from '@/components/ui/sonner';

export function CurrencyBackfillCard() {
  const { t } = useTranslation();
  const backfill = useBackfillCurrency();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof backfill.mutateAsync>>['data'] | null>(null);

  const runPreview = async () => {
    try {
      const res = await backfill.mutateAsync(true);
      setPreview(res.data);
      setOpen(true);
    } catch (err: any) {
      toast.error(err.message || t('common.error'));
    }
  };

  const runApply = async () => {
    try {
      const res = await backfill.mutateAsync(false);
      toast.success(t('currency.backfillApplied', { count: res.data.converted }));
      setOpen(false);
      setPreview(null);
    } catch (err: any) {
      toast.error(err.message || t('common.error'));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="flex-1">
          <p className="font-medium">{t('currency.backfillTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('currency.backfillDescription')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={runPreview} disabled={backfill.isPending}>
          {backfill.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t('currency.preview')}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('currency.backfillPreviewTitle')}</DialogTitle>
            <DialogDescription>
              {preview
                ? t('currency.backfillPreviewSummary', { count: preview.total_candidates, skipped: preview.skipped })
                : ''}
            </DialogDescription>
          </DialogHeader>
          {preview && preview.preview.length > 0 ? (
            <div className="max-h-80 overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">{t('transactions.date')}</th>
                    <th className="text-left p-2">{t('transactions.description')}</th>
                    <th className="text-right p-2">{t('currency.original')}</th>
                    <th className="text-right p-2">CAD</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-2 text-muted-foreground">{p.date}</td>
                      <td className="p-2">{p.name}</td>
                      <td className="p-2 text-right">{p.original_amount.toFixed(2)} {p.currency}</td>
                      <td className="p-2 text-right font-medium">${p.cad_amount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('currency.noCandidates')}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={runApply}
              disabled={backfill.isPending || !preview || preview.total_candidates === 0}
            >
              {backfill.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('currency.applyBackfill')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
