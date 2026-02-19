import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useSyncAllConnections } from '@/hooks/use-plaid';
import { toast } from '@/components/ui/sonner';

export function SyncButton() {
  const { t } = useTranslation();
  const syncAll = useSyncAllConnections();

  const handleSync = async () => {
    try {
      const result = await syncAll.mutateAsync();
      if (result.added === 0 && result.modified === 0 && result.removed === 0) {
        toast.info(t('sync.upToDate'));
      } else {
        toast.success(t('sync.synced', { added: result.added, modified: result.modified, removed: result.removed }));
      }
    } catch (error: any) {
      toast.error(error.message || t('sync.failedSync'));
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={syncAll.isPending}>
      {syncAll.isPending ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-2" />
      )}
      {syncAll.isPending ? t('sync.syncing') : t('sync.sync')}
    </Button>
  );
}
