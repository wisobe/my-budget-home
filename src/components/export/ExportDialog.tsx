import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Download, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';
import { toast } from '@/components/ui/sonner';

interface ExportDialogProps {
  trigger?: React.ReactNode;
  format: 'csv' | 'json';
}

export function ExportDialog({ trigger, format }: ExportDialogProps) {
  const { t } = useTranslation();
  const { plaidEnvironment } = usePlaidEnvironment();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = sessionStorage.getItem('auth_token');
      const params = new URLSearchParams({ format, plaid_environment: plaidEnvironment });
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const url = `${API_BASE_URL}/transactions/export.php?${params}`;
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Export failed' }));
        throw new Error(err.message || 'Export failed');
      }

      if (format === 'csv') {
        const blob = await response.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `transactions_${startDate || 'all'}_${endDate || 'all'}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        const json = await response.json();
        const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `budgetwise_export_${startDate || 'all'}_${endDate || 'all'}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      }

      toast.success(t('export.success'));
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || t('export.failed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            {format === 'csv' ? t('settings.exportCSV') : t('settings.exportJSON')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {format === 'csv' ? t('settings.exportCSV') : t('settings.exportJSON')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('export.dateRangeDesc')}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('export.startDate')}</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('export.endDate')}</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('export.leaveEmpty')}</p>
          <Button className="w-full" onClick={handleExport} disabled={exporting}>
            {exporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Download className="h-4 w-4 mr-2" />
            {t('export.exportNow')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
