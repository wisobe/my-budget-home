import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, ExternalLink, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock connection data for demo
const mockConnections = [
  {
    id: '1',
    institution_id: 'ins_desjardins',
    institution_name: 'Desjardins',
    status: 'active' as const,
    last_synced: new Date().toISOString(),
    accounts_count: 3,
  },
];

const Connections = () => {
  const connections = mockConnections;

  return (
    <AppLayout
      title="Bank Connections"
      actions={
        <Button size="sm">
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
                  Your backend API needs to handle Plaid API calls and store access tokens securely.
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
            {connections.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <ExternalLink className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-2">No banks connected</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect your bank accounts to automatically sync transactions
                </p>
                <Button>
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
                        {connection.accounts_count} accounts • Last synced {new Date(connection.last_synced).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Backend Setup Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Backend Setup Required</CardTitle>
            <CardDescription>
              To use Plaid with this app, your backend API needs these endpoints
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="p-3 rounded-lg bg-muted font-mono">
                <p className="text-muted-foreground mb-1"># Create Plaid Link token</p>
                <p>POST /api/plaid/link-token</p>
              </div>
              <div className="p-3 rounded-lg bg-muted font-mono">
                <p className="text-muted-foreground mb-1"># Exchange public token for access token</p>
                <p>POST /api/plaid/exchange-token</p>
              </div>
              <div className="p-3 rounded-lg bg-muted font-mono">
                <p className="text-muted-foreground mb-1"># Sync transactions from Plaid</p>
                <p>POST /api/plaid/connections/:id/sync</p>
              </div>
              <p className="text-muted-foreground">
                Store your Plaid API keys (client_id, secret) securely on your server. 
                For Desjardins, you'll need Plaid's Canada integration.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Connections;
