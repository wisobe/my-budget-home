import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useCategories } from '@/hooks/use-transactions';
import { Plus, Trash2, CheckCircle2, XCircle, Loader2, Database, Key, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { API_BASE_URL } from '@/lib/config';
import { useMockDataSetting } from '@/contexts/MockDataContext';

const Settings = () => {
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.data || [];
  const { useMockData, setUseMockData } = useMockDataSetting();
  
  const [dbTestStatus, setDbTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dbTestMessage, setDbTestMessage] = useState('');

  const testDatabaseConnection = async () => {
    setDbTestStatus('testing');
    try {
      const apiUrl = `${API_BASE_URL}/settings/test-db.php`;
      const response = await fetch(apiUrl, { method: 'POST' });
      const result = await response.json();
      
      if (result.data?.success) {
        setDbTestStatus('success');
        setDbTestMessage(`Connected! MariaDB ${result.data.version}`);
      } else {
        setDbTestStatus('error');
        setDbTestMessage(result.data?.message || 'Connection failed');
      }
    } catch (error) {
      setDbTestStatus('error');
      setDbTestMessage('Could not reach API endpoint');
    }
  };

  return (
    <AppLayout title="Settings">
      <div className="space-y-6 max-w-2xl">
        {/* Setup Guide */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Backend Setup Guide
            </CardTitle>
            <CardDescription>
              Follow these steps to connect your self-hosted backend
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <Badge variant="outline" className="shrink-0">1</Badge>
                <div>
                  <p className="font-medium">Upload PHP API files to your Apache server</p>
                  <p className="text-muted-foreground">Copy the <code className="bg-muted px-1 rounded">/api</code> folder to your server's public directory</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="shrink-0">2</Badge>
                <div>
                  <p className="font-medium">Create the database schema</p>
                  <p className="text-muted-foreground">Run <code className="bg-muted px-1 rounded">schema.sql</code> in your MariaDB database</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="shrink-0">3</Badge>
                <div>
                  <p className="font-medium">Configure your credentials</p>
                  <p className="text-muted-foreground">Copy <code className="bg-muted px-1 rounded">config.sample.php</code> to <code className="bg-muted px-1 rounded">config.php</code> and fill in your database and Plaid credentials</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge variant="outline" className="shrink-0">4</Badge>
                <div>
                  <p className="font-medium">Set the API URL</p>
                  <p className="text-muted-foreground">Set <code className="bg-muted px-1 rounded">VITE_API_URL</code> in your .env file (e.g., <code className="bg-muted px-1 rounded">https://yourdomain.com/api</code>)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              API Configuration
            </CardTitle>
            <CardDescription>
              Configure your backend API endpoint
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-url">Backend API URL</Label>
              <Input
                id="api-url"
                placeholder="https://your-server.com/api"
                defaultValue={import.meta.env.VITE_API_URL || '/api'}
                readOnly
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Set this in your .env file as <code className="bg-muted px-1 rounded">VITE_API_URL</code>
              </p>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label>Database Connection</Label>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={testDatabaseConnection}
                  disabled={dbTestStatus === 'testing'}
                >
                  {dbTestStatus === 'testing' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {dbTestStatus === 'success' && <CheckCircle2 className="h-4 w-4 mr-2 text-income" />}
                  {dbTestStatus === 'error' && <XCircle className="h-4 w-4 mr-2 text-destructive" />}
                  Test Connection
                </Button>
                {dbTestMessage && (
                  <p className={`text-sm self-center ${dbTestStatus === 'success' ? 'text-income' : 'text-destructive'}`}>
                    {dbTestMessage}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plaid Configuration Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Plaid Configuration
            </CardTitle>
            <CardDescription>
              Your Plaid credentials are stored securely on your server
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select defaultValue="sandbox" disabled>
                  <SelectTrigger className="bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value="Canada (CA)" readOnly className="bg-muted" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Edit these settings in <code className="bg-muted px-1 rounded">config.php</code> on your server.
              Get your API keys from{' '}
              <a 
                href="https://dashboard.plaid.com/developers/keys" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Plaid Dashboard
              </a>
            </p>
          </CardContent>
        </Card>

        {/* Categories Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Categories</CardTitle>
                <CardDescription>
                  Manage your transaction categories
                </CardDescription>
              </div>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categories.map(category => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="font-medium">{category.name}</span>
                    {category.is_income && (
                      <Badge variant="secondary" className="text-xs">Income</Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>
              Customize your app experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Use Mock Data</p>
                <p className="text-sm text-muted-foreground">
                  Toggle between mock data and real database
                </p>
              </div>
              <Switch checked={useMockData} onCheckedChange={setUseMockData} />
            </div>
            <p className="text-xs text-muted-foreground">
              When disabled, data is fetched from your real database API
            </p>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Dark Mode</p>
                <p className="text-sm text-muted-foreground">Toggle dark theme</p>
              </div>
              <Switch />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto-sync Transactions</p>
                <p className="text-sm text-muted-foreground">Sync on app load</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Show Pending Transactions</p>
                <p className="text-sm text-muted-foreground">Include pending in totals</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Data Export */}
        <Card>
          <CardHeader>
            <CardTitle>Data Export</CardTitle>
            <CardDescription>
              Export your financial data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button variant="outline">Export Transactions (CSV)</Button>
              <Button variant="outline">Export All Data (JSON)</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Settings;
