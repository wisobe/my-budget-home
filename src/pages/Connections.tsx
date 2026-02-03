import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, ExternalLink, Trash2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlaidConnections, useSyncPlaidConnection, useRemovePlaidConnection } from '@/hooks/use-plaid';
import { toast } from '@/components/ui/sonner';

const Connections = () => {
  const { data: connectionsData, isLoading } = usePlaidConnections();
  const syncMutation = useSyncPlaidConnection();
  const removeMutation = useRemovePlaidConnection();
  
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

  const handleConnectBank = () => {
    toast.info('To connect a bank, ensure your backend is configured with Plaid credentials');
  };

  return (
    <AppLayout
      title="Bank Connections"
      actions={
        <Button size="sm" onClick={handleConnectBank}>
          <Plus className="h-4 w-4 mr-2" />
          Connect Bank
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Info Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ExternalLink className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Plaid Integration</h3>
                <p className="text-sm text-muted-foreground">
                  This app uses Plaid to securely connect to your Canadian financial institutions like Desjardins. 
                  Your PHP backend handles Plaid API calls and stores access tokens securely.
                </p>
                <a 
                  href="https://plaid.com/docs/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline mt-2 inline-block"
                >
                  View Plaid Documentation →
                </a>
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
                  Connect your bank accounts to automatically sync transactions
                </p>
                <Button onClick={handleConnectBank}>
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Your First Bank
                </Button>
              </div>
            ) : (
              connections.map(connection => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary">
                        {connection.institution_name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{connection.institution_name}</p>
                        <Badge 
                          variant={connection.status === 'active' ? 'default' : 'destructive'}
                          className={cn(
                            connection.status === 'active' && "bg-income"
                          )}
                        >
                          {connection.status === 'active' ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1" /> Active</>
                          ) : (
                            <><AlertCircle className="h-3 w-3 mr-1" /> Error</>
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Last synced {connection.last_synced ? new Date(connection.last_synced).toLocaleString() : 'Never'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleSync(connection.id)}
                      disabled={syncMutation.isPending}
                    >
                      {syncMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Sync
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemove(connection.id)}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* PHP Backend Setup Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>PHP Backend Endpoints</CardTitle>
            <CardDescription>
              These PHP endpoints are included in your /api folder
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="p-3 rounded-lg bg-muted font-mono">
                <p className="text-muted-foreground mb-1"># Create Plaid Link token</p>
                <p>POST /api/plaid/link-token.php</p>
              </div>
              <div className="p-3 rounded-lg bg-muted font-mono">
                <p className="text-muted-foreground mb-1"># Exchange public token for access token</p>
                <p>POST /api/plaid/exchange-token.php</p>
              </div>
              <div className="p-3 rounded-lg bg-muted font-mono">
                <p className="text-muted-foreground mb-1"># Sync transactions from Plaid</p>
                <p>POST /api/plaid/sync.php</p>
              </div>
              <div className="p-3 rounded-lg bg-muted font-mono">
                <p className="text-muted-foreground mb-1"># List bank connections</p>
                <p>GET /api/plaid/connections.php</p>
              </div>
              <p className="text-muted-foreground">
                Configure your Plaid API keys in <code className="bg-muted px-1 rounded">config.php</code> on your server.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Connections;
