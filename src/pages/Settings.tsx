import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCategories, useDeleteCategory, useUpdateCategory, useCategoryRules, useCreateCategoryRule, useDeleteCategoryRule, useUpdateCategoryRule } from '@/hooks/use-transactions';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2, CheckCircle2, XCircle, Loader2, Key, ExternalLink, FlaskConical, Building2, Lock, LogOut, Sparkles, Globe, ChevronRight, ChevronDown, Pencil, ArrowLeft } from 'lucide-react';
import { useState, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { API_BASE_URL } from '@/lib/config';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { cn } from '@/lib/utils';
import { categoriesApi, authApi } from '@/lib/api';
import { ExportDialog } from '@/components/export/ExportDialog';
import { EditCategoryDialog } from '@/components/categories/EditCategoryDialog';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import type { Category } from '@/types';

const Settings = () => {
  const { t } = useTranslation();
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.data || [];
  const { plaidEnvironment, setPlaidEnvironment, canUseSandbox } = usePlaidEnvironment();
  const { logout, user, isAdmin } = useAuth();
  const { darkMode, setDarkMode, autoSync, setAutoSync, showPending, setShowPending, language, setLanguage } = usePreferences();
  const deleteCategoryMutation = useDeleteCategory();
  const { data: rulesData } = useCategoryRules();
  const createRuleMutation = useCreateCategoryRule();
  const deleteRuleMutation = useDeleteCategoryRule();
  const updateRuleMutation = useUpdateCategoryRule();
  const rules = rulesData?.data || [];

  const [dbTestStatus, setDbTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dbTestMessage, setDbTestMessage] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6b7280');
  const [newCatIsIncome, setNewCatIsIncome] = useState(false);
  const [newCatParentId, setNewCatParentId] = useState('');
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [addingCat, setAddingCat] = useState(false);

  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [newRuleKeyword, setNewRuleKeyword] = useState('');
  const [newRuleCategoryId, setNewRuleCategoryId] = useState('');
  const [newRuleMatchType, setNewRuleMatchType] = useState('contains');
  const [newRuleApplyExisting, setNewRuleApplyExisting] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Category drill-down state
  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [editCatOpen, setEditCatOpen] = useState(false);
  const [editRuleId, setEditRuleId] = useState<string | null>(null);
  const [editRuleKeyword, setEditRuleKeyword] = useState('');
  const [editRuleCategoryId, setEditRuleCategoryId] = useState('');
  const [editRuleMatchType, setEditRuleMatchType] = useState('contains');
  const [editRuleApplyExisting, setEditRuleApplyExisting] = useState(false);

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
        setDbTestMessage(t('settings.connected', { version: result.data.version }));
      } else {
        setDbTestStatus('error');
        setDbTestMessage(result.data?.message || t('settings.connectionFailed'));
      }
    } catch {
      setDbTestStatus('error');
      setDbTestMessage(t('settings.couldNotReach'));
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(t('settings.deleteCategoryConfirm', { name }))) return;
    try {
      await deleteCategoryMutation.mutateAsync(id);
      toast.success(t('settings.categoryDeleted', { name }));
    } catch (err: any) {
      toast.error(err.message || t('settings.failedDeleteCategory'));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('settings.passwordsDontMatch'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('settings.passwordTooShort'));
      return;
    }
    setChangingPassword(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success(t('settings.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || t('settings.failedChangePassword'));
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <AppLayout title={t('settings.title')}>
      <div className="space-y-6 max-w-2xl">
        {/* Account & Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  {t('settings.account')}
                </CardTitle>
                <CardDescription>
                  {user ? t('settings.signedInAs', { email: user.email }) : t('settings.manageAccount')}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {user && (
                  <Badge variant={isAdmin ? 'default' : 'secondary'}>
                    {isAdmin ? t('settings.admin') : t('settings.user')}
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={logout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('nav.logout')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('settings.currentPassword')}</Label>
                <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('settings.newPassword')}</Label>
                  <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.confirmNewPassword')}</Label>
                  <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                </div>
              </div>
              <Button type="submit" disabled={changingPassword || !currentPassword || !newPassword}>
                {changingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('settings.changePassword')}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Plaid Configuration - Sandbox toggle only for admins */}
        {canUseSandbox && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                {t('settings.plaidEnvironment')}
                <Badge variant="outline" className="text-xs">{t('settings.admin')}</Badge>
              </CardTitle>
              <CardDescription>{t('settings.plaidEnvDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>{t('settings.activeEnvironment')}</Label>
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
                      <p className="font-medium">{t('settings.sandboxLabel')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.sandboxDesc')}</p>
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
                      <p className="font-medium">{t('settings.productionLabel')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.productionDesc')}</p>
                    </div>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{t('settings.envSeparate')}</p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>{t('settings.country')}</Label>
                <Input value="Canada (CA)" readOnly className="bg-muted" />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('settings.configureCredentials')} <code className="bg-muted px-1 rounded">config.php</code>.{' '}
                <a href="https://dashboard.plaid.com/developers/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {t('settings.plaidDashboard')}
                </a>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Backend Setup Guide - Admin only */}
        {isAdmin && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                {t('settings.backendSetupGuide')}
                <Badge variant="outline" className="text-xs">{t('settings.admin')}</Badge>
              </CardTitle>
              <CardDescription>{t('settings.backendSetupDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <Badge variant="outline" className="shrink-0">1</Badge>
                  <div>
                    <p className="font-medium">{t('settings.step1Title')}</p>
                    <p className="text-muted-foreground">{t('settings.step1Desc')}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Badge variant="outline" className="shrink-0">2</Badge>
                  <div>
                    <p className="font-medium">{t('settings.step2Title')}</p>
                    <p className="text-muted-foreground">{t('settings.step2Desc')}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Badge variant="outline" className="shrink-0">3</Badge>
                  <div>
                    <p className="font-medium">{t('settings.step3Title')}</p>
                    <p className="text-muted-foreground">{t('settings.step3Desc')}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Badge variant="outline" className="shrink-0">4</Badge>
                  <div>
                    <p className="font-medium">{t('settings.step4Title')}</p>
                    <p className="text-muted-foreground">{t('settings.step4Desc')}</p>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>{t('settings.dbConnection')}</Label>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={testDatabaseConnection} disabled={dbTestStatus === 'testing'}>
                    {dbTestStatus === 'testing' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {dbTestStatus === 'success' && <CheckCircle2 className="h-4 w-4 mr-2 text-income" />}
                    {dbTestStatus === 'error' && <XCircle className="h-4 w-4 mr-2 text-destructive" />}
                    {t('settings.testConnection')}
                  </Button>
                  {dbTestMessage && (
                    <p className={`text-sm self-center ${dbTestStatus === 'success' ? 'text-income' : 'text-destructive'}`}>{dbTestMessage}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Categories Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('settings.categories')}</CardTitle>
                <CardDescription>{t('settings.manageCategories')}</CardDescription>
              </div>
              <Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-2" />{t('settings.addCategory')}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t('settings.addCategory')}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('settings.categoryName')}</Label>
                      <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder={t('settings.categoryNamePlaceholder')} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('settings.color')}</Label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
                        <Input value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="flex-1" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={newCatIsIncome} onCheckedChange={setNewCatIsIncome} />
                      <Label>{t('settings.incomeCategory')}</Label>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('settings_categories.parentCategory')}</Label>
                      <Select value={newCatParentId} onValueChange={setNewCatParentId}>
                        <SelectTrigger><SelectValue placeholder={t('settings_categories.noParent')} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('settings_categories.noParent')}</SelectItem>
                          {categories.filter(c => !c.parent_id).map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                                {c.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" disabled={!newCatName.trim() || addingCat} onClick={async () => {
                      setAddingCat(true);
                      try {
                        await categoriesApi.create({
                          name: newCatName.trim(),
                          color: newCatColor,
                          is_income: newCatIsIncome,
                          parent_id: newCatParentId && newCatParentId !== 'none' ? newCatParentId : undefined,
                        } as any);
                        queryClient.invalidateQueries({ queryKey: ['categories'] });
                        toast.success(t('settings.categoryCreated'));
                        setNewCatName(''); setNewCatColor('#6b7280'); setNewCatIsIncome(false); setNewCatParentId(''); setAddCatOpen(false);
                      } catch (e: any) {
                        toast.error(e.message || t('settings.failedCreateCategory'));
                      } finally { setAddingCat(false); }
                    }}>
                      {addingCat ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      {t('settings.createCategory')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative overflow-hidden">
              {/* Parent categories view */}
              <div
                className={cn(
                  "transition-all duration-300 ease-in-out",
                  expandedParentId ? "-translate-x-full opacity-0 absolute inset-0" : "translate-x-0 opacity-100"
                )}
              >
                <div className="space-y-1">
                  {categories.filter(c => !c.parent_id).map(category => {
                    const children = categories.filter(c => c.parent_id === category.id);
                    return (
                      <div
                        key={category.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                        onClick={() => children.length > 0 ? setExpandedParentId(category.id) : undefined}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: category.color }} />
                          <span className="font-medium">{category.name}</span>
                          {!!category.is_income && <Badge variant="secondary" className="text-xs">{t('transactions.income')}</Badge>}
                          {children.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {children.length} {t('settings_categories.subcategories')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="sm"
                            className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); setEditCategory(category); setEditCatOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); handleDeleteCategory(category.id, category.name); }}
                            disabled={deleteCategoryMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {children.length > 0 && (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Children view (slides in from right) */}
              <div
                className={cn(
                  "transition-all duration-300 ease-in-out",
                  expandedParentId ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 absolute inset-0"
                )}
              >
                {expandedParentId && (() => {
                  const parent = categories.find(c => c.id === expandedParentId);
                  const children = categories.filter(c => c.parent_id === expandedParentId);
                  if (!parent) return null;
                  return (
                    <div className="space-y-1">
                      <button
                        onClick={() => setExpandedParentId(null)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        {t('settings_categories.backToParents')}
                      </button>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 mb-2">
                        <div className="h-5 w-5 rounded-full" style={{ backgroundColor: parent.color }} />
                        <span className="font-semibold text-lg">{parent.name}</span>
                      </div>
                      {children.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {t('settings_categories.noParent')}
                        </p>
                      ) : (
                        children.map(child => (
                          <div key={child.id} className="flex items-center justify-between p-3 pl-6 rounded-lg hover:bg-muted/50 transition-colors group">
                            <div className="flex items-center gap-3">
                              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: child.color }} />
                              <span className="text-sm">{child.name}</span>
                              {!!child.is_income && <Badge variant="secondary" className="text-xs">{t('transactions.income')}</Badge>}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost" size="sm"
                                className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => { setEditCategory(child); setEditCatOpen(true); }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDeleteCategory(child.id, child.name)}
                                disabled={deleteCategoryMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            <EditCategoryDialog
              open={editCatOpen}
              onOpenChange={setEditCatOpen}
              category={editCategory}
            />
          </CardContent>
        </Card>

        {/* Auto-Categorization Rules */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  {t('settings.autoCategorization')}
                </CardTitle>
                <CardDescription>{t('settings.autoCategorizationDesc')}</CardDescription>
              </div>
              <Dialog open={addRuleOpen} onOpenChange={setAddRuleOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-2" />{t('settings.addRule')}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t('settings.addCategorizationRule')}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('settings.keyword')}</Label>
                      <Input value={newRuleKeyword} onChange={e => setNewRuleKeyword(e.target.value)} placeholder={t('settings.keywordPlaceholder')} />
                      <p className="text-xs text-muted-foreground">{t('settings.keywordDesc')}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('transactions.category')}</Label>
                      <RuleCategoryPicker
                        categories={categories}
                        value={newRuleCategoryId}
                        onChange={setNewRuleCategoryId}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('settings.matchType')}</Label>
                      <Select value={newRuleMatchType} onValueChange={setNewRuleMatchType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contains">{t('settings.contains')}</SelectItem>
                          <SelectItem value="exact">{t('settings.exactMatch')}</SelectItem>
                          <SelectItem value="starts_with">{t('settings.startsWith')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="new-rule-apply" checked={newRuleApplyExisting} onCheckedChange={(v) => setNewRuleApplyExisting(!!v)} />
                      <Label htmlFor="new-rule-apply" className="text-sm font-normal cursor-pointer">{t('settings.applyToExisting')}</Label>
                    </div>
                    <Button
                      className="w-full"
                      disabled={!newRuleKeyword.trim() || !newRuleCategoryId || createRuleMutation.isPending}
                      onClick={async () => {
                        try {
                          await createRuleMutation.mutateAsync({
                            category_id: newRuleCategoryId,
                            keyword: newRuleKeyword.trim(),
                            match_type: newRuleMatchType,
                            apply_to_existing: newRuleApplyExisting,
                          });
                          toast.success(t('settings.ruleCreated'));
                          setNewRuleKeyword('');
                          setNewRuleCategoryId('');
                          setNewRuleMatchType('contains');
                          setNewRuleApplyExisting(false);
                          setAddRuleOpen(false);
                        } catch (e: any) {
                          toast.error(e.message || t('settings.failedCreateRule'));
                        }
                      }}
                    >
                      {createRuleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {t('settings.createRule')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('settings.noRulesYet')}</p>
            ) : (
              <div className="space-y-2">
                {rules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: rule.category_color || '#6b7280' }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium font-mono text-sm">{rule.keyword}</span>
                          <Badge variant="outline" className="text-xs shrink-0">{rule.match_type}</Badge>
                          {!!rule.auto_learned && <Badge variant="secondary" className="text-xs shrink-0">{t('common.auto')}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">→ {rule.category_name || t('dashboard.unknown')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          setEditRuleId(rule.id);
                          setEditRuleKeyword(rule.keyword);
                          setEditRuleCategoryId(rule.category_id);
                          setEditRuleMatchType(rule.match_type);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={async () => {
                          if (!confirm(t('settings.deleteRuleConfirm', { keyword: rule.keyword }))) return;
                          try {
                            await deleteRuleMutation.mutateAsync(rule.id);
                            toast.success(t('settings.ruleDeleted'));
                          } catch (e: any) {
                            toast.error(e.message || t('settings.failedDeleteRule'));
                          }
                        }}
                        disabled={deleteRuleMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Rule Dialog */}
        <Dialog open={!!editRuleId} onOpenChange={(open) => { if (!open) setEditRuleId(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('settings.editRule')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('settings.keyword')}</Label>
                <Input value={editRuleKeyword} onChange={e => setEditRuleKeyword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('transactions.category')}</Label>
                <RuleCategoryPicker
                  categories={categories}
                  value={editRuleCategoryId}
                  onChange={setEditRuleCategoryId}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.matchType')}</Label>
                <Select value={editRuleMatchType} onValueChange={setEditRuleMatchType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">{t('settings.contains')}</SelectItem>
                    <SelectItem value="exact">{t('settings.exactMatch')}</SelectItem>
                    <SelectItem value="starts_with">{t('settings.startsWith')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="edit-rule-apply" checked={editRuleApplyExisting} onCheckedChange={(v) => setEditRuleApplyExisting(!!v)} />
                <Label htmlFor="edit-rule-apply" className="text-sm font-normal cursor-pointer">{t('settings.applyToExisting')}</Label>
              </div>
              <Button
                className="w-full"
                disabled={!editRuleKeyword.trim() || !editRuleCategoryId || updateRuleMutation.isPending}
                onClick={async () => {
                  try {
                    await updateRuleMutation.mutateAsync({
                      id: editRuleId!,
                      keyword: editRuleKeyword.trim(),
                      category_id: editRuleCategoryId,
                      match_type: editRuleMatchType,
                      apply_to_existing: editRuleApplyExisting,
                    });
                    toast.success(t('settings.ruleUpdated'));
                    setEditRuleId(null);
                    setEditRuleApplyExisting(false);
                  } catch (e: any) {
                    toast.error(e.message || t('settings.failedUpdateRule'));
                  }
                }}
              >
                {updateRuleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('settings.saveRule')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.preferences')}</CardTitle>
            <CardDescription>{t('settings.customizeExperience')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t('settings.darkMode')}</p>
                <p className="text-sm text-muted-foreground">{t('settings.toggleDarkTheme')}</p>
              </div>
              <Switch checked={darkMode} onCheckedChange={setDarkMode} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t('settings.autoSyncTransactions')}</p>
                <p className="text-sm text-muted-foreground">{t('settings.syncOnLoad')}</p>
              </div>
              <Switch checked={autoSync} onCheckedChange={setAutoSync} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t('settings.showPendingTransactions')}</p>
                <p className="text-sm text-muted-foreground">{t('settings.includePending')}</p>
              </div>
              <Switch checked={showPending} onCheckedChange={setShowPending} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t('settings.language')}</p>
                  <p className="text-sm text-muted-foreground">{t('settings.languageDesc')}</p>
                </div>
              </div>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Data Export */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.dataExport')}</CardTitle>
            <CardDescription>{t('settings.exportData')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <ExportDialog format="csv" />
              <ExportDialog format="json" />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

function RuleCategoryPicker({ categories, value, onChange }: { categories: Category[]; value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [expandedParent, setExpandedParent] = useState<string | null>(null);

  const parentCategories = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  const selectedCat = categories.find(c => c.id === value);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setExpandedParent(null);
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setExpandedParent(null); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          {selectedCat ? (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: selectedCat.color }} />
              <span>{selectedCat.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{t('settings.selectCategory')}</span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0 max-h-[300px] overflow-y-auto" align="start" collisionPadding={8}>
          <div className="p-1">
            {parentCategories.map(cat => {
              const children = getChildren(cat.id);
              const hasChildren = children.length > 0;
              const isExpanded = expandedParent === cat.id;

              return (
                <div key={cat.id}>
                  <button
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-sm rounded-sm hover:bg-muted transition-colors text-left",
                      isExpanded && hasChildren && "bg-muted"
                    )}
                    onClick={() => {
                      if (hasChildren) {
                        setExpandedParent(prev => prev === cat.id ? null : cat.id);
                      } else {
                        handleSelect(cat.id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span>{cat.name}</span>
                    </div>
                    {hasChildren && (
                      <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                    )}
                  </button>

                  {hasChildren && isExpanded && (
                    <div className="ml-4 border-l border-border pl-1">
                      <button
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors text-left font-medium"
                        onClick={() => handleSelect(cat.id)}
                      >
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        {cat.name} ({t('common.all') || 'All'})
                      </button>
                      {children.map(child => (
                        <button
                          key={child.id}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors text-left"
                          onClick={() => handleSelect(child.id)}
                        >
                          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: child.color }} />
                          {child.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        
      </PopoverContent>
    </Popover>
  );
}

export default Settings;
