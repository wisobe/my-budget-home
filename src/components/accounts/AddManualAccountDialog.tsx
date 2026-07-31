import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCreateManualAccount } from '@/hooks/use-accounts';
import { useTranslation } from 'react-i18next';

const TYPES = ['checking', 'savings', 'credit', 'investment', 'loan', 'other'];

interface AddManualAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddManualAccountDialog({ open, onOpenChange }: AddManualAccountDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const createAccount = useCreateManualAccount();

  const [name, setName] = useState('');
  const [type, setType] = useState('checking');
  const [currency, setCurrency] = useState('CAD');
  const [institution, setInstitution] = useState('');
  const [balance, setBalance] = useState('');

  const reset = () => {
    setName('');
    setType('checking');
    setCurrency('CAD');
    setInstitution('');
    setBalance('');
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: t('accounts.manual.nameRequired'), variant: 'destructive' });
      return;
    }
    try {
      await createAccount.mutateAsync({
        name: trimmed,
        type,
        currency,
        institution_name: institution.trim() || undefined,
        current_balance: balance ? Number(balance) : 0,
      });
      toast({ title: t('accounts.manual.created') });
      handleClose(false);
    } catch (error) {
      toast({
        title: t('accounts.manual.createFailed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('accounts.manual.title')}</DialogTitle>
          <DialogDescription>{t('accounts.manual.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manual-name">{t('accounts.manual.name')}</Label>
            <Input
              id="manual-name"
              value={name}
              maxLength={100}
              onChange={e => setName(e.target.value)}
              placeholder={t('accounts.manual.namePlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('accounts.manual.type')}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map(value => (
                    <SelectItem key={value} value={value}>
                      {t(`accounts.types.${value}`, value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('accounts.manual.currency')}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['CAD', 'USD', 'EUR', 'GBP'].map(code => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-institution">{t('accounts.manual.institution')}</Label>
            <Input
              id="manual-institution"
              value={institution}
              maxLength={100}
              onChange={e => setInstitution(e.target.value)}
              placeholder={t('accounts.manual.institutionPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-balance">{t('accounts.manual.balance')}</Label>
            <Input
              id="manual-balance"
              type="number"
              step="0.01"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={createAccount.isPending}>
            {createAccount.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
