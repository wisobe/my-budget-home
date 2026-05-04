import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw } from 'lucide-react';
import { useUpdateTransactionAmount } from '@/hooks/use-transactions';
import { toast } from '@/components/ui/sonner';
import type { Transaction } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
}

export function EditAmountDialog({ open, onOpenChange, transaction }: Props) {
  const { t } = useTranslation();
  const mutation = useUpdateTransactionAmount();
  const [value, setValue] = useState('');

  useEffect(() => {
    if (transaction) setValue(Math.abs(Number(transaction.amount)).toFixed(2));
  }, [transaction, open]);

  if (!transaction) return null;

  const isExpense = Number(transaction.amount) >= 0;
  const isOverridden = !!transaction.amount_overridden;
  const hasOriginal = transaction.original_amount != null && transaction.iso_currency_code;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(value);
    if (!isFinite(n) || n < 0) {
      toast.error(t('transactions.invalidAmount'));
      return;
    }
    try {
      await mutation.mutateAsync({
        id: transaction.id,
        amount: isExpense ? Math.abs(n) : -Math.abs(n),
      });
      toast.success(t('transactions.amountUpdated'));
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || t('common.error'));
    }
  };

  const handleReset = async () => {
    try {
      await mutation.mutateAsync({ id: transaction.id, reset: true });
      toast.success(t('transactions.amountReset'));
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || t('common.error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('transactions.editAmount')}</DialogTitle>
          <DialogDescription>
            {hasOriginal
              ? t('transactions.editAmountForeignDescription', {
                  original: `${Number(transaction.original_amount).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${transaction.iso_currency_code}`,
                })
              : t('transactions.editAmountDescription')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('transactions.amountInCad')}</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {isOverridden && hasOriginal && (
              <Button type="button" variant="outline" onClick={handleReset} disabled={mutation.isPending}>
                <RotateCcw className="h-4 w-4 mr-2" />
                {t('transactions.resetToFx')}
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
