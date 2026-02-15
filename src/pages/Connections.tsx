import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, ExternalLink, Trash2, AlertCircle, CheckCircle2, Loader2, FlaskConical, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlaidConnections, useCreateLinkToken, useExchangePlaidToken, useSyncPlaidConnection, useRemovePlaidConnection } from '@/hooks/use-plaid';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';
import { toast } from '@/components/ui/sonner';
import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';

function PlaidLinkButton({ linkToken, onSuccess, onExit }: {
  linkToken: string;
  onSuccess: (publicToken: string, metadata: any) => void;
  onExit: () => void;
}) {
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken, metadata) => onSuccess(publicToken, metadata),
    onExit: () => onExit(),
  });

  useEffect(() => {
    if (ready) open();
  }, [ready, open]);

  return null;
}

const Connections = () => {
  const { data: connectionsData, isLoading } = usePlaidConnections();
  const createLinkTokenMutation = useCreateLinkToken();
  const exchangeTokenMutation = useExchangePlaidToken();
  const syncMutation = useSyncPlaidConnection();
  const removeMutation = useRemovePlaidConnection();
  const { plaidEnvironment } = usePlaidEnvironment();

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connections = connectionsData?.data || [];

  const handleSync = async (connectionId: string) => {
    try {
      const result = await syncMutation.mutateAsync(connectionId);
      toast.success(`Synced ${result.data.added} new transactions`);
    } catch (error) {
      toast.error('Failed to sync transactions');
    }
  };

  const handleRemove = async (connectionId: string) => {
    if (!confirm('Are you sure you want to remove this bank connection?')) return;
    try {
      await removeMutation.mutateAsync(connectionId);
      toast.success('Bank connection removed');
    } catch (error) {
      toast.error('Failed to remove connection');
    }
  };

  const handleConnectBank = async () => {
    setIsConnecting(true);
    try {
      const result = await createLinkTokenMutation.mutateAsync();
      setLinkToken(result.data.link_token);
    } catch (error: any) {
      toast.error(`Failed to initialize bank connection: ${error.message}`);
      setIsConnecting(false);
    }
  };

  const handlePlaidSuccess = useCallback(async (publicToken: string, metadata: any) => {
    setLinkToken(null);
    try {
      const institutionId = metadata?.institution?.institution_id || 'unknown';
      const result = await exchangeTokenMutation.mutateAsync({ publicToken, institutionId });
      toast.success('Bank connected! Syncing transactions...');
      try {
        const connectionId = result.data?.id;
        if (connectionId) {
          const syncResult = await syncMutation.mutateAsync(connectionId);
          toast.success(`Initial sync complete: ${syncResult.data.added} transactions imported.`);
        }
      } catch {
        toast.warning('Bank connected, but initial sync failed. Try the Sync button manually.');
      }
    } catch (error: any) {
      toast.error(`Failed to connect bank: ${error.message}`);
    } finally {
      setIsConnecting(false);
    }
  }, [exchangeTokenMutation, syncMutation]);

  const handlePlaidExit = useCallback(() => {
    setLinkToken(null);
    setIsConnecting(false);
  }, []);

  return (
    <AppLayout
      title="Bank Connections"
      actions={
        <Button size="sm" onClick={handleConnectBank} disabled={isConnecting}>
          {isConnecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Connect Bank
        </Button>
      }
    >
      {linkToken && <PlaidLinkButton linkToken={linkToken} onSuccess={handlePlaidSuccess} onExit={handlePlaidExit} />}

      <div className="space-y-6">
        {/* Environment Indicator */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                {plaidEnvironment === 'sandbox' ? <FlaskConical className="h-5 w-5 text-primary" /> : <Building2 className="h-5 w-5 text-primary" />}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">Plaid Integration</h3>
                  <Badge variant="outline" className={cn(
                    plaidEnvironment === 'sandbox' ? "border-amber-500 text-amber-600" : "border-emerald-500 text-emerald-600"
                  )}>
                    {plaidEnvironment === 'sandbox' ? 'Sandbox' : 'Production'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {plaidEnvironment === 'sandbox'
                    ? 'You are using sandbox mode with test bank data. Switch to production in Settings when ready for real banks.'
                    : 'You are using production mode with real bank connections.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connected Banks */}
        <Card>
          <CardHeader>
            <CardTitle>Connected Banks</CardTitle>
            <CardDescription>
              Manage your bank connections and sync status
              {plaidEnvironment === 'sandbox' && ' (sandbox environment)'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : connections.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <ExternalLink className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-2">No banks connected</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {plaidEnvironment === 'sandbox'
                    ? 'Connect a test bank to try out the transaction sync flow'
                    : 'Connect your bank accounts to automatically sync transactions'}
                </p>
                <Button onClick={handleConnectBank} disabled={isConnecting}>
                  {isConnecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Connect Your First Bank
                </Button>
              </div>
            ) : (
              connections.map(connection => (
                <div key={connection.id} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary">{connection.institution_name.charAt(0)}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{connection.institution_name}</p>
                        <Badge variant={connection.status === 'active' ? 'default' : 'destructive'} className={cn(connection.status === 'active' && "bg-income")}>
                          {connection.status === 'active' ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Active</> : <><AlertCircle className="h-3 w-3 mr-1" /> Error</>}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Last synced {connection.last_synced ? new Date(connection.last_synced).toLocaleString() : 'Never'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleSync(connection.id)} disabled={syncMutation.isPending}>
                      {syncMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Sync
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleRemove(connection.id)} disabled={removeMutation.isPending}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Connections;
