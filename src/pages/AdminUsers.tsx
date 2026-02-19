import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, Users, Shield, User } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Navigate } from 'react-router-dom';
import type { User as UserType } from '@/types';

const AdminUsers = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [creating, setCreating] = useState(false);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => authApi.listUsers(),
    enabled: isAdmin,
  });

  const users = usersData?.data || [];

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleCreateUser = async () => {
    if (!newEmail || !newName || !newPassword) return;
    setCreating(true);
    try {
      await authApi.createUser({
        email: newEmail,
        name: newName,
        password: newPassword,
        role: newRole,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(t('adminUsers.userCreated'));
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewRole('user');
      setAddOpen(false);
    } catch (err: any) {
      toast.error(err.message || t('adminUsers.failedCreateUser'));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (user: UserType) => {
    if (!confirm(t('adminUsers.deleteUserConfirm', { name: user.name, email: user.email }))) return;
    try {
      await authApi.deleteUser(user.id);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(t('adminUsers.userDeleted', { name: user.name }));
    } catch (err: any) {
      toast.error(err.message || t('adminUsers.failedDeleteUser'));
    }
  };

  return (
    <AppLayout title={t('adminUsers.title')}>
      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('adminUsers.users')}
                </CardTitle>
                <CardDescription>{t('adminUsers.manageUsers')}</CardDescription>
              </div>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    {t('adminUsers.addUser')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('adminUsers.createNewUser')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('adminUsers.name')}</Label>
                      <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="John Doe" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('adminUsers.email')}</Label>
                      <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="john@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('adminUsers.password')}</Label>
                      <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('adminUsers.role')}</Label>
                      <Select value={newRole} onValueChange={setNewRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {t('adminUsers.userRole')}
                            </div>
                          </SelectItem>
                          <SelectItem value="admin">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              {t('adminUsers.adminRole')}
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {t('adminUsers.roleDescription')}
                      </p>
                    </div>
                    <Button
                      className="w-full"
                      disabled={!newEmail || !newName || !newPassword || newPassword.length < 6 || creating}
                      onClick={handleCreateUser}
                    >
                      {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {t('adminUsers.createUser')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('adminUsers.noUsersFound')}
              </p>
            ) : (
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                        {u.role === 'admin' ? (
                          <Shield className="h-4 w-4 text-primary" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{u.name}</span>
                          <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                            {u.role}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleDeleteUser(u)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminUsers;
