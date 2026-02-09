import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useSyncAllConnections } from '@/hooks/use-plaid';
import { useMockDataSetting } from '@/contexts/MockDataContext';
import { toast } from '@/components/ui/sonner';

export function SyncButton() {
  const syncAll = useSyncAllConnections();
  const { useMockData } = useMockDataSetting();

  const handleSync = async () => {
    if (useMockData) {
      toast.info('Disable mock data in Settings to sync real transactions.');
      return;
    }

    try {
      const result = await syncAll.mutateAsync();
      if (result.added === 0 && result.modified === 0 && result.removed === 0) {
        toast.info('Already up to date — no new transactions.');
      } else {
        toast.success(
          `Synced: ${result.added} added, ${result.modified} modified, ${result.removed} removed.`
        );
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync transactions');
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={syncAll.isPending}
    >
      {syncAll.isPending ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-2" />
      )}
      {syncAll.isPending ? 'Syncing...' : 'Sync'}
    </Button>
  );
}
