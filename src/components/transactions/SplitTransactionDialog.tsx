import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useCategories, useTransactionSplits, useSaveTransactionSplits, useDeleteTransactionSplits } from '@/hooks/use-transactions';
import { toast } from '@/components/ui/sonner';
import type { Transaction } from '@/types';

interface SplitLine {
  category_id: string;
  amount: string;
  is_excluded: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
}

export function SplitTransactionDialog({ open, onOpenChange, transaction }: Props) {
  const { t } = useTranslation();
  const { data: categoriesData } = useCategories();
  const { data: splitsData } = useTransactionSplits(open && transaction ? transaction.id : null);
  const saveMutation = useSaveTransactionSplits();
  const deleteMutation = useDeleteTransactionSplits();

  const categories = categoriesData?.data || [];
  const totalAmount = transaction ? Math.abs(transaction.amount) : 0;

  const [lines, setLines] = useState<SplitLine[]>([
    { category_id: '', amount: '', is_excluded: false },
    { category_id: '', amount: '', is_excluded: false },
  ]);

  useEffect(() => {
    if (splitsData?.data && splitsData.data.length > 0) {
      setLines(splitsData.data.map(s => ({
        category_id: s.category_id || '',
        amount: Math.abs(s.amount).toString(),
        is_excluded: s.is_excluded,
      })));
    } else if (transaction) {
      setLines([
        { category_id: transaction.category_id || '', amount: '', is_excluded: false },
        { category_id: '', amount: '', is_excluded: false },
      ]);
    }
  }, [splitsData, transaction]);

  const usedAmount = lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
  const remaining = totalAmount - usedAmount;

  const addLine = () => {
    setLines([...lines, { category_id: '', amount: remaining > 0 ? remaining.toFixed(2) : '', is_excluded: false }]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof SplitLine, value: string | boolean) => {
    const updated = [...lines];
    (updated[idx] as any)[field] = value;
    setLines(updated);
  };

  const handleSave = async () => {
    if (Math.abs(remaining) > 0.01) {
      toast.error(t('splitDialog.mustEqual', { total: totalAmount.toFixed(2), remaining: remaining.toFixed(2) }));
      return;
    }

    const validLines = lines.filter(l => parseFloat(l.amount) > 0);
    if (validLines.length < 2) {
      toast.error(t('splitDialog.atLeast2'));
      return;
    }

    try {
      const sign = transaction!.amount >= 0 ? 1 : -1;
      await saveMutation.mutateAsync({
        transaction_id: transaction!.id,
        splits: validLines.map(l => ({
          category_id: l.is_excluded ? undefined : (l.category_id || undefined),
          amount: parseFloat(l.amount) * sign,
          is_excluded: l.is_excluded,
        })),
      });
      toast.success(t('splitDialog.splitSaved'));
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || t('splitDialog.failedSave'));
    }
  };

  const handleRemoveSplit = async () => {
    if (!transaction) return;
    try {
      await deleteMutation.mutateAsync(transaction.id);
      toast.success(t('splitDialog.splitRemoved'));
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || t('splitDialog.failedRemove'));
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('splitDialog.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 text-sm">
          <p className="font-medium">{transaction.name}</p>
          <p className="text-muted-foreground">{t('splitDialog.total', { amount: totalAmount.toFixed(2) })}</p>
        </div>

        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {lines.map((line, idx) => (
            <div key={idx} className="flex items-end gap-2 p-3 rounded-lg border bg-card">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">
                  {line.is_excluded ? t('splitDialog.excluded') : t('splitDialog.category')}
                </Label>
                {!line.is_excluded && (
                  <Select value={line.category_id} onValueChange={v => updateLine(idx, 'category_id', v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder={t('transactions.select')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                            {c.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs">{t('transactions.amount')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-8 text-sm"
                  value={line.amount}
                  onChange={e => updateLine(idx, 'amount', e.target.value)}
                />
              </div>
              <div className="flex flex-col items-center gap-1 pb-1">
                <Label className="text-xs">{t('splitDialog.excl')}</Label>
                <Switch
                  checked={line.is_excluded}
                  onCheckedChange={v => updateLine(idx, 'is_excluded', v)}
                  className="scale-75"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeLine(idx)}
                disabled={lines.length <= 2}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm">
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-3.5 w-3.5 mr-1" /> {t('splitDialog.addLine')}
          </Button>
          <p className={Math.abs(remaining) > 0.01 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
            {t('splitDialog.remaining', { amount: remaining.toFixed(2) })}
          </p>
        </div>

        <div className="flex gap-2">
          {(splitsData?.data?.length ?? 0) > 0 && (
            <Button variant="outline" onClick={handleRemoveSplit} disabled={deleteMutation.isPending} className="text-destructive">
              {t('splitDialog.removeSplit')}
            </Button>
          )}
          <Button className="flex-1" onClick={handleSave} disabled={saveMutation.isPending || Math.abs(remaining) > 0.01}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('splitDialog.saveSplit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
