import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { usePreferences } from '@/contexts/PreferencesContext';
import { API_BASE_URL } from '@/lib/config';

interface DeleteDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteDataDialog({ open, onOpenChange }: DeleteDataDialogProps) {
  const { t } = useTranslation();
  const { setConsentDataStorage } = usePreferences();
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const canDelete = password.length > 0 && confirmText === 'DELETE';

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE_URL}/settings/delete-user-data.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete data');
      
      setConsentDataStorage(false);
      toast.success(t('consent.deleteData.success'));
      onOpenChange(false);
      setPassword('');
      setConfirmText('');
    } catch (err: any) {
      toast.error(err.message || t('consent.deleteData.failed'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isDeleting) { onOpenChange(v); setPassword(''); setConfirmText(''); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>{t('consent.deleteData.title')}</DialogTitle>
              <DialogDescription>{t('consent.deleteData.description')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {t('consent.deleteData.warning')}
          </div>

          <div className="space-y-2">
            <Label>{t('consent.deleteData.confirmLabel')}</Label>
            <Input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder='DELETE'
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label>{t('consent.deleteData.passwordLabel')}</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('consent.deleteData.passwordPlaceholder')}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!canDelete || isDeleting} className="w-full sm:w-auto">
            {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('consent.deleteData.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
