import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw } from 'lucide-react';
import { useUpdateTransactionDate } from '@/hooks/use-transactions';
import { toast } from '@/components/ui/sonner';
import type { Transaction } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
}

export function EditDateDialog({ open, onOpenChange, transaction }: Props) {
  const { t } = useTranslation();
  const mutation = useUpdateTransactionDate();
  const [value, setValue] = useState('');

  useEffect(() => {
    if (transaction) setValue(transaction.date);
  }, [transaction, open]);

  if (!transaction) return null;

  const isOverridden = !!transaction.date_overridden;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      toast.error(t('transactions.invalidDate'));
      return;
    }
    try {
      await mutation.mutateAsync({ id: transaction.id, date: value });
      toast.success(t('transactions.dateUpdated'));
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || t('common.error'));
    }
  };

  const handleReset = async () => {
    try {
      await mutation.mutateAsync({ id: transaction.id, reset: true });
      toast.success(t('transactions.dateReset'));
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || t('common.error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('transactions.editDate')}</DialogTitle>
          <DialogDescription>
            {isOverridden && transaction.original_date
              ? t('transactions.editDateOverriddenDescription', { original: transaction.original_date })
              : t('transactions.editDateDescription')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('transactions.date')}</Label>
            <Input type="date" value={value} onChange={e => setValue(e.target.value)} required />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {isOverridden && !!transaction.original_date && (
              <Button type="button" variant="outline" onClick={handleReset} disabled={mutation.isPending}>
                <RotateCcw className="h-4 w-4 mr-2" />
                {t('transactions.resetToBankDate')}
              </Button>
            )}
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
