import { useMemo, useRef, useState } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAccounts } from '@/hooks/use-accounts';
import { useImportCsv, useImportPreview } from '@/hooks/use-transactions';
import { autoMapHeaders, detectDelimiter, guessDateFormat, parseCsv } from '@/lib/csv';
import type { CsvImportPreview, CsvImportRow } from '@/lib/api';
import { useTranslation } from 'react-i18next';

const NONE = '__none__';

const FIELDS = [
  { key: 'date', required: true },
  { key: 'name', required: true },
  { key: 'amount', required: false },
  { key: 'debit', required: false },
  { key: 'credit', required: false },
  { key: 'merchant_name', required: false },
  { key: 'notes', required: false },
  { key: 'currency', required: false },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];

interface ImportCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportCsvDialog({ open, onOpenChange }: ImportCsvDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: accountsData } = useAccounts();
  const previewMutation = useImportPreview();
  const importMutation = useImportCsv();

  const [step, setStep] = useState<'upload' | 'map' | 'review'>('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [accountId, setAccountId] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dateFormat, setDateFormat] = useState('auto');
  const [signConvention, setSignConvention] = useState<'positive_expense' | 'positive_income'>('positive_income');
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);

  const accounts = accountsData?.data ?? [];

  const headers = useMemo(() => {
    if (rows.length === 0) return [];
    return hasHeader
      ? rows[0].map((h, i) => h.trim() || `${t('transactions.import.column')} ${i + 1}`)
      : rows[0].map((_, i) => `${t('transactions.import.column')} ${i + 1}`);
  }, [rows, hasHeader, t]);

  const dataRows = useMemo(() => (hasHeader ? rows.slice(1) : rows), [rows, hasHeader]);

  const reset = () => {
    setStep('upload');
    setFileName('');
    setRows([]);
    setHasHeader(true);
    setMapping({});
    setDateFormat('auto');
    setSignConvention('positive_income');
    setAllowDuplicates(false);
    setPreview(null);
    previewMutation.reset();
    importMutation.reset();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: t('transactions.import.fileTooLarge'), variant: 'destructive' });
      return;
    }
    const text = await file.text();
    const delimiter = detectDelimiter(text);
    const parsed = parseCsv(text, delimiter);

    if (parsed.length === 0) {
      toast({ title: t('transactions.import.emptyFile'), variant: 'destructive' });
      return;
    }

    setFileName(file.name);
    setRows(parsed);
    setMapping(autoMapHeaders(parsed[0].map(h => h.trim())));
    setStep('map');
  };

  const buildRows = (): CsvImportRow[] => {
    const idx = (field: FieldKey) => {
      const value = mapping[field];
      return value === undefined || value === NONE ? -1 : Number(value);
    };
    const indices = Object.fromEntries(FIELDS.map(f => [f.key, idx(f.key)])) as Record<FieldKey, number>;

    return dataRows.map(cols => {
      const row: CsvImportRow = {};
      (Object.keys(indices) as FieldKey[]).forEach(field => {
        const i = indices[field];
        if (i >= 0 && cols[i] !== undefined) row[field] = cols[i];
      });
      return row;
    });
  };

  const canContinue =
    !!accountId &&
    mapping.date !== undefined && mapping.date !== NONE &&
    mapping.name !== undefined && mapping.name !== NONE &&
    ((mapping.amount !== undefined && mapping.amount !== NONE) ||
      (mapping.debit !== undefined && mapping.debit !== NONE) ||
      (mapping.credit !== undefined && mapping.credit !== NONE));

  const usesAmountColumn = mapping.amount !== undefined && mapping.amount !== NONE;

  const handlePreview = async () => {
    const payloadRows = buildRows();
    if (payloadRows.length === 0) {
      toast({ title: t('transactions.import.noRows'), variant: 'destructive' });
      return;
    }
    try {
      const result = await previewMutation.mutateAsync({
        account_id: accountId,
        rows: payloadRows,
        mapping: { date_format: dateFormat, sign_convention: signConvention },
        allow_duplicates: allowDuplicates,
      });
      setPreview(result.data);
      setStep('review');
    } catch (error) {
      toast({
        title: t('transactions.import.previewFailed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    try {
      const result = await importMutation.mutateAsync({
        account_id: accountId,
        rows: buildRows(),
        mapping: { date_format: dateFormat, sign_convention: signConvention },
        allow_duplicates: allowDuplicates,
      });
      toast({
        title: t('transactions.import.success'),
        description: t('transactions.import.successDetail', {
          imported: result.data.imported,
          skipped: result.data.skipped_duplicates,
        }),
      });
      handleClose(false);
    } catch (error) {
      toast({
        title: t('transactions.import.importFailed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const detectedFormat = useMemo(() => {
    const i = mapping.date !== undefined && mapping.date !== NONE ? Number(mapping.date) : -1;
    if (i < 0) return null;
    return guessDateFormat(dataRows.slice(0, 20).map(r => r[i] ?? ''));
  }, [mapping.date, dataRows]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('transactions.import.title')}</DialogTitle>
          <DialogDescription>{t('transactions.import.description')}</DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-lg border-2 border-dashed border-border p-10 text-center transition-colors hover:border-primary/60 hover:bg-muted/40"
            >
              <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">{t('transactions.import.chooseFile')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('transactions.import.fileHint')}</p>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{fileName}</span>
              <Badge variant="secondary">
                {t('transactions.import.rowsDetected', { count: dataRows.length })}
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('transactions.import.account')}</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('transactions.import.selectAccount')} />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(account => (
                      <SelectItem key={account.id} value={String(account.id)}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('transactions.import.dateFormat')}</Label>
                <Select value={dateFormat} onValueChange={setDateFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">
                      {t('transactions.import.autoDetect')}
                      {detectedFormat ? ` (${detectedFormat})` : ''}
                    </SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="csv-has-header"
                checked={hasHeader}
                onCheckedChange={checked => {
                  const next = !!checked;
                  setHasHeader(next);
                  if (next && rows.length > 0) setMapping(autoMapHeaders(rows[0].map(h => h.trim())));
                }}
              />
              <Label htmlFor="csv-has-header" className="cursor-pointer text-sm font-normal">
                {t('transactions.import.hasHeader')}
              </Label>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-4">
              <p className="text-sm font-medium">{t('transactions.import.mapColumns')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {FIELDS.map(field => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-xs">
                      {t(`transactions.import.fields.${field.key}`)}
                      {field.required && <span className="ml-1 text-destructive">*</span>}
                    </Label>
                    <Select
                      value={mapping[field.key] ?? NONE}
                      onValueChange={value => setMapping(prev => ({ ...prev, [field.key]: value }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t('transactions.import.notMapped')}</SelectItem>
                        {headers.map((header, index) => (
                          <SelectItem key={index} value={String(index)}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t('transactions.import.amountHint')}</p>
            </div>

            {usesAmountColumn && (
              <div className="space-y-2">
                <Label>{t('transactions.import.signConvention')}</Label>
                <Select
                  value={signConvention}
                  onValueChange={value => setSignConvention(value as typeof signConvention)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive_income">{t('transactions.import.signPositiveIncome')}</SelectItem>
                    <SelectItem value="positive_expense">{t('transactions.import.signPositiveExpense')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="csv-allow-dupes"
                checked={allowDuplicates}
                onCheckedChange={checked => setAllowDuplicates(!!checked)}
              />
              <Label htmlFor="csv-allow-dupes" className="cursor-pointer text-sm font-normal">
                {t('transactions.import.allowDuplicates')}
              </Label>
            </div>
          </div>
        )}

        {step === 'review' && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-2xl font-semibold text-emerald-600">{preview.to_import}</p>
                <p className="text-xs text-muted-foreground">{t('transactions.import.willImport')}</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-2xl font-semibold text-amber-600">{preview.duplicates}</p>
                <p className="text-xs text-muted-foreground">{t('transactions.import.duplicatesSkipped')}</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-2xl font-semibold text-destructive">{preview.invalid}</p>
                <p className="text-xs text-muted-foreground">{t('transactions.import.invalidRows')}</p>
              </div>
            </div>

            {preview.invalid > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <div className="mb-1 flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  {t('transactions.import.invalidRows')}
                </div>
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {preview.invalid_rows.map(row => (
                    <li key={row.row}>
                      {t('transactions.import.rowLabel', { row: row.row })} —{' '}
                      {t(`transactions.import.reasons.${row.reason}`, row.reason)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.preview.length > 0 && (
              <div className="rounded-lg border border-border">
                <p className="border-b border-border px-3 py-2 text-sm font-medium">
                  {t('transactions.import.previewTitle')}
                </p>
                <ScrollArea className="h-64">
                  <table className="w-full text-sm">
                    <tbody>
                      {preview.preview.map(row => (
                        <tr key={row.row} className="border-b border-border/60 last:border-0">
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{row.date}</td>
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                            {new Intl.NumberFormat('en-CA', {
                              style: 'currency',
                              currency: row.currency || 'CAD',
                            }).format(-Number(row.amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            )}

            {preview.to_import === 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />
                {t('transactions.import.nothingToImport')}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {step === 'map' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                {t('common.back')}
              </Button>
              <Button onClick={handlePreview} disabled={!canContinue || previewMutation.isPending}>
                {previewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('transactions.import.continue')}
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={() => setStep('map')}>
                {t('common.back')}
              </Button>
              <Button
                onClick={handleImport}
                disabled={importMutation.isPending || !preview || preview.to_import === 0}
              >
                {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('transactions.import.confirm', { count: preview?.to_import ?? 0 })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
