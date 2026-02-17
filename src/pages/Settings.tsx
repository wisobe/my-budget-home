import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useCategories, useDeleteCategory } from '@/hooks/use-transactions';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2, CheckCircle2, XCircle, Loader2, Key, ExternalLink, FlaskConical, Building2, Lock, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { API_BASE_URL } from '@/lib/config';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { cn } from '@/lib/utils';
import { categoriesApi, authApi } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';

const Settings = () => {
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.data || [];
  const { plaidEnvironment, setPlaidEnvironment } = usePlaidEnvironment();
  const { logout } = useAuth();
  const { darkMode, setDarkMode, autoSync, setAutoSync, showPending, setShowPending } = usePreferences();
  const deleteCategoryMutation = useDeleteCategory();

  const [dbTestStatus, setDbTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dbTestMessage, setDbTestMessage] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6b7280');
  const [newCatIsIncome, setNewCatIsIncome] = useState(false);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [addingCat, setAddingCat] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const queryClient = useQueryClient();

  const testDatabaseConnection = async () => {
    setDbTestStatus('testing');
    try {
      const apiUrl = `${API_BASE_URL}/settings/test-db.php`;
      const token = sessionStorage.getItem('auth_token');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      const result = await response.json();
      if (result.data?.success) {
        setDbTestStatus('success');
        setDbTestMessage(`Connected! MariaDB ${result.data.version}`);
      } else {
        setDbTestStatus('error');
        setDbTestMessage(result.data?.message || 'Connection failed');
      }
    } catch {
      setDbTestStatus('error');
      setDbTestMessage('Could not reach API endpoint');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? Transactions using this category will be moved to "Other".`)) return;
    try {
      await deleteCategoryMutation.mutateAsync(id);
      toast.success(`Category "${name}" deleted`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete category');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setChangingPassword(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <AppLayout title="Settings">
      <div className="space-y-6 max-w-2xl">
        {/* Security / Password */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Security
                </CardTitle>
                <CardDescription>Change your app password</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                </div>
              </div>
              <Button type="submit" disabled={changingPassword || !currentPassword || !newPassword}>
                {changingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Change Password
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Setup Guide */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Backend Setup Guide
            </CardTitle>
            <CardDescription>Follow these steps to connect your self-hosted backend</CardDescription>
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
                  <p className="text-muted-foreground">Set <code className="bg-muted px-1 rounded">VITE_API_URL</code> in your .env file</p>
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Database Connection</Label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={testDatabaseConnection} disabled={dbTestStatus === 'testing'}>
                  {dbTestStatus === 'testing' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {dbTestStatus === 'success' && <CheckCircle2 className="h-4 w-4 mr-2 text-income" />}
                  {dbTestStatus === 'error' && <XCircle className="h-4 w-4 mr-2 text-destructive" />}
                  Test Connection
                </Button>
                {dbTestMessage && (
                  <p className={`text-sm self-center ${dbTestStatus === 'success' ? 'text-income' : 'text-destructive'}`}>{dbTestMessage}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plaid Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Plaid Configuration
            </CardTitle>
            <CardDescription>Switch between sandbox (test) and production (real bank) environments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>Active Environment</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPlaidEnvironment('sandbox')}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left",
                    plaidEnvironment === 'sandbox' ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <FlaskConical className={cn("h-5 w-5", plaidEnvironment === 'sandbox' ? "text-primary" : "text-muted-foreground")} />
                  <div>
                    <p className="font-medium">Sandbox</p>
                    <p className="text-xs text-muted-foreground">Test with fake bank data</p>
                  </div>
                </button>
                <button
                  onClick={() => setPlaidEnvironment('production')}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left",
                    plaidEnvironment === 'production' ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <Building2 className={cn("h-5 w-5", plaidEnvironment === 'production' ? "text-primary" : "text-muted-foreground")} />
                  <div>
                    <p className="font-medium">Production</p>
                    <p className="text-xs text-muted-foreground">Real bank connections</p>
                  </div>
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Each environment uses separate Plaid credentials and stores connections independently.
              </p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value="Canada (CA)" readOnly className="bg-muted" />
            </div>
            <p className="text-xs text-muted-foreground">
              Configure credentials in <code className="bg-muted px-1 rounded">config.php</code>.{' '}
              <a href="https://dashboard.plaid.com/developers/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
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
                <CardDescription>Manage your transaction categories</CardDescription>
              </div>
              <Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Category</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Subscriptions" />
                    </div>
                    <div className="space-y-2">
                      <Label>Color</Label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
                        <Input value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="flex-1" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={newCatIsIncome} onCheckedChange={setNewCatIsIncome} />
                      <Label>Income category</Label>
                    </div>
                    <Button className="w-full" disabled={!newCatName.trim() || addingCat} onClick={async () => {
                      setAddingCat(true);
                      try {
                        await categoriesApi.create({ name: newCatName.trim(), color: newCatColor, is_income: newCatIsIncome });
                        queryClient.invalidateQueries({ queryKey: ['categories'] });
                        toast.success('Category created');
                        setNewCatName(''); setNewCatColor('#6b7280'); setNewCatIsIncome(false); setAddCatOpen(false);
                      } catch (e: any) {
                        toast.error(e.message || 'Failed to create category');
                      } finally { setAddingCat(false); }
                    }}>
                      {addingCat ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Create Category
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categories.map(category => (
                <div key={category.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: category.color }} />
                    <span className="font-medium">{category.name}</span>
                    {category.is_income && <Badge variant="secondary" className="text-xs">Income</Badge>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteCategory(category.id, category.name)}
                    disabled={deleteCategoryMutation.isPending}
                  >
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
            <CardDescription>Customize your app experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Dark Mode</p>
                <p className="text-sm text-muted-foreground">Toggle dark theme</p>
              </div>
              <Switch checked={darkMode} onCheckedChange={setDarkMode} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto-sync Transactions</p>
                <p className="text-sm text-muted-foreground">Sync on app load</p>
              </div>
              <Switch checked={autoSync} onCheckedChange={setAutoSync} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Show Pending Transactions</p>
                <p className="text-sm text-muted-foreground">Include pending in totals</p>
              </div>
              <Switch checked={showPending} onCheckedChange={setShowPending} />
            </div>
          </CardContent>
        </Card>

        {/* Data Export */}
        <Card>
          <CardHeader>
            <CardTitle>Data Export</CardTitle>
            <CardDescription>Export your financial data</CardDescription>
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
