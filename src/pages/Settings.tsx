import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useCategories, useDeleteCategory, useUpdateCategory, useCategoryRules, useCreateCategoryRule, useDeleteCategoryRule, useUpdateCategoryRule, useExclusionRules, useCreateExclusionRule, useDeleteExclusionRule, useUpdateExclusionRule } from '@/hooks/use-transactions';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2, Loader2, Lock, LogOut, Sparkles, Globe, ChevronRight, Pencil, ArrowLeft, FlaskConical, Building2, Key, ShieldCheck, Download, Tags, SlidersHorizontal, ChevronsDownUp, Play, EyeOff } from 'lucide-react';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';
import { TwoFactorSettings, TwoFactorHeader } from '@/components/settings/TwoFactorSettings';
import { useState, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { API_BASE_URL } from '@/lib/config';
import { usePreferences } from '@/contexts/PreferencesContext';
import { cn } from '@/lib/utils';
import { categoriesApi, authApi, exclusionRulesApi } from '@/lib/api';
import { ExportDialog } from '@/components/export/ExportDialog';
import { PrivacyConsentSettings } from '@/components/consent/PrivacyConsentSettings';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { EditCategoryDialog } from '@/components/categories/EditCategoryDialog';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import type { Category } from '@/types';

const Settings = () => {
  const { t } = useTranslation();
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.data || [];
  const { logout, user, isAdmin } = useAuth();
  const { themeMode, setThemeMode, autoSync, setAutoSync, showPending, setShowPending, language, setLanguage, settingsExpandedSections, setSettingsExpandedSections, autoLearnRules, setAutoLearnRules } = usePreferences();
  const { plaidEnvironment, setPlaidEnvironment, canUseSandbox } = usePlaidEnvironment();
  const deleteCategoryMutation = useDeleteCategory();
  const { data: rulesData } = useCategoryRules();
  const createRuleMutation = useCreateCategoryRule();
  const deleteRuleMutation = useDeleteCategoryRule();
  const updateRuleMutation = useUpdateCategoryRule();
  const rules = rulesData?.data || [];

  const { data: exclusionRulesData } = useExclusionRules();
  const createExclusionRuleMutation = useCreateExclusionRule();
  const deleteExclusionRuleMutation = useDeleteExclusionRule();
  const updateExclusionRuleMutation = useUpdateExclusionRule();
  const exclusionRules = exclusionRulesData?.data || [];

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
  const [applyingAllRules, setApplyingAllRules] = useState(false);
  const [applyAllPreviewOpen, setApplyAllPreviewOpen] = useState(false);
  const [applyAllPreview, setApplyAllPreview] = useState<Array<{
    id: string; name: string; merchant_name: string | null; amount: number; date: string;
    current_category_name: string | null; current_category_color: string | null;
    new_category_name: string; new_category_color: string;
  }> | null>(null);
  const [applyAllPreviewLoading, setApplyAllPreviewLoading] = useState(false);

  // Exclusion rules state
  const [addExclRuleOpen, setAddExclRuleOpen] = useState(false);
  const [newExclKeyword, setNewExclKeyword] = useState('');
  const [newExclMatchType, setNewExclMatchType] = useState('contains');
  const [newExclApplyExisting, setNewExclApplyExisting] = useState(false);
  const [editExclRuleId, setEditExclRuleId] = useState<string | null>(null);
  const [editExclKeyword, setEditExclKeyword] = useState('');
  const [editExclMatchType, setEditExclMatchType] = useState('contains');
  const [editExclApplyExisting, setEditExclApplyExisting] = useState(false);
  const [applyAllExclPreviewOpen, setApplyAllExclPreviewOpen] = useState(false);
  const [applyAllExclPreview, setApplyAllExclPreview] = useState<Array<{
    id: string; name: string; merchant_name: string | null; amount: number; date: string;
  }> | null>(null);
  const [applyAllExclPreviewLoading, setApplyAllExclPreviewLoading] = useState(false);
  const [applyingAllExclRules, setApplyingAllExclRules] = useState(false);

  const queryClient = useQueryClient();

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
      <div className="flex justify-start gap-2 max-w-2xl mb-4">
        <Button variant="outline" size="sm" onClick={() => setSettingsExpandedSections(['account', 'twoFactor', 'categories', 'rules', 'exclusionRules', 'preferences', 'plaidEnv', 'privacy', 'export'])}>
          <ChevronsDownUp className="h-4 w-4 mr-2 rotate-180" />
          {t('settings.expandAll')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSettingsExpandedSections([])}>
          <ChevronsDownUp className="h-4 w-4 mr-2" />
          {t('settings.collapseAll')}
        </Button>
      </div>
      <Accordion
        type="multiple"
        value={settingsExpandedSections}
        onValueChange={setSettingsExpandedSections}
        className="space-y-4 max-w-2xl"
      >
        {/* Account & Security */}
        <AccordionItem value="account" className="border-none">
          <Card>
            <CardHeader className="pb-4">
              <AccordionTrigger className="hover:no-underline py-0">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  <div className="text-left">
                    <CardTitle className="text-lg">{t('settings.account')}</CardTitle>
                    <CardDescription>
                      {user ? t('settings.signedInAs', { email: user.email }) : t('settings.manageAccount')}
                    </CardDescription>
                  </div>
                </div>
              </AccordionTrigger>
              <div className="flex items-center gap-2 absolute right-6 top-6">
                {user && (
                  <Badge variant={isAdmin ? 'default' : 'secondary'}>
                    {isAdmin ? t('settings.admin') : t('settings.user')}
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); logout(); }}>
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('nav.logout')}
                </Button>
              </div>
            </CardHeader>
            <AccordionContent>
              <CardContent className="pt-4">
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
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* Two-Factor Authentication */}
        <AccordionItem value="twoFactor" className="border-none">
          <Card>
            <CardHeader className="pb-4">
              <AccordionTrigger className="hover:no-underline py-0">
                <TwoFactorHeader />
              </AccordionTrigger>
            </CardHeader>
            <AccordionContent>
              <CardContent className="pt-4">
                <TwoFactorSettings />
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* Categories Management */}
        <AccordionItem value="categories" className="border-none">
          <Card>
            <CardHeader className="pb-4">
              <AccordionTrigger className="hover:no-underline py-0">
                <div className="flex items-center gap-2">
                  <Tags className="h-5 w-5" />
                  <div className="text-left">
                    <CardTitle className="text-lg">{t('settings.categories')}</CardTitle>
                    <CardDescription>{t('settings.manageCategories')}</CardDescription>
                  </div>
                </div>
              </AccordionTrigger>
            </CardHeader>
            <AccordionContent>
              <CardContent className="pt-4">
                <div className="flex justify-start mb-4">
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
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* Auto-Categorization Rules */}
        <AccordionItem value="rules" className="border-none">
          <Card>
            <CardHeader className="pb-4">
              <AccordionTrigger className="hover:no-underline py-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  <div className="text-left">
                    <CardTitle className="text-lg">{t('settings.autoCategorization')}</CardTitle>
                    <CardDescription>{t('settings.autoCategorizationDesc')}</CardDescription>
                  </div>
                </div>
              </AccordionTrigger>
            </CardHeader>
            <AccordionContent>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-muted/50">
                  <div>
                    <Label className="font-medium">{t('settings.autoLearnRules')}</Label>
                    <p className="text-xs text-muted-foreground">{t('settings.autoLearnRulesDesc')}</p>
                  </div>
                  <Switch checked={autoLearnRules} onCheckedChange={setAutoLearnRules} />
                </div>
                <div className="flex justify-start gap-2 mb-4">
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
                <Dialog open={applyAllPreviewOpen} onOpenChange={(open) => {
                  setApplyAllPreviewOpen(open);
                  if (!open) { setApplyAllPreview(null); }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={rules.length === 0 || applyingAllRules} onClick={async () => {
                      setApplyAllPreviewOpen(true);
                      setApplyAllPreviewLoading(true);
                      setApplyAllPreview(null);
                      try {
                        const res = await categoriesApi.previewApplyAllRules(plaidEnvironment);
                        setApplyAllPreview(res?.data?.transactions ?? []);
                      } catch {
                        setApplyAllPreview([]);
                      } finally {
                        setApplyAllPreviewLoading(false);
                      }
                    }}>
                      {applyingAllRules ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                      {t('settings.applyAllRules')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                      <DialogTitle>{t('settings.applyAllRulesTitle')}</DialogTitle>
                    </DialogHeader>
                    {applyAllPreviewLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">{t('settings.applyAllRulesLoading')}</span>
                      </div>
                    ) : applyAllPreview && applyAllPreview.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">{t('settings.applyAllRulesNoChanges')}</p>
                    ) : applyAllPreview ? (
                      <>
                        <p className="text-sm text-muted-foreground">{t('settings.applyAllRulesDesc')}</p>
                        <p className="text-sm font-medium">{t('settings.applyAllRulesCount', { count: applyAllPreview.length })}</p>
                        <div className="flex-1 overflow-auto border rounded-md">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50 sticky top-0">
                              <tr className="border-b">
                                <th className="text-left p-2 font-medium">{t('transactions.date')}</th>
                                <th className="text-left p-2 font-medium">{t('transactions.description')}</th>
                                <th className="text-right p-2 font-medium">{t('transactions.amount')}</th>
                                <th className="text-left p-2 font-medium">{t('settings.applyAllRulesCurrentCat')}</th>
                                <th className="text-left p-2 font-medium">{t('settings.applyAllRulesNewCat')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {applyAllPreview.map((tx) => (
                                <tr key={tx.id} className="border-b last:border-0">
                                  <td className="p-2 whitespace-nowrap">{tx.date}</td>
                                  <td className="p-2 truncate max-w-[200px]">{tx.merchant_name || tx.name}</td>
                                  <td className="p-2 text-right whitespace-nowrap">${Math.abs(tx.amount).toFixed(2)}</td>
                                  <td className="p-2">
                                    <span className="inline-flex items-center gap-1">
                                      {tx.current_category_color && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: tx.current_category_color }} />}
                                      {tx.current_category_name || t('settings.applyAllRulesNoCat')}
                                    </span>
                                  </td>
                                  <td className="p-2">
                                    <span className="inline-flex items-center gap-1">
                                      {tx.new_category_color && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: tx.new_category_color }} />}
                                      {tx.new_category_name}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : null}
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setApplyAllPreviewOpen(false)}>{t('common.cancel')}</Button>
                      <Button
                        disabled={applyAllPreviewLoading || !applyAllPreview || applyAllPreview.length === 0 || applyingAllRules}
                        onClick={async () => {
                          setApplyingAllRules(true);
                          try {
                            const res = await categoriesApi.applyAllRules(plaidEnvironment);
                            const count = res?.data?.applied_count ?? 0;
                            toast.success(t('settings.applyAllRulesSuccess', { count }));
                            queryClient.invalidateQueries({ queryKey: ['transactions'] });
                            setApplyAllPreviewOpen(false);
                          } catch (e: any) {
                            toast.error(e.message || t('settings.applyAllRulesFailed'));
                          } finally {
                            setApplyingAllRules(false);
                          }
                        }}
                      >
                        {applyingAllRules && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {t('settings.applyAllRulesConfirm')}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                </div>
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
            </AccordionContent>
          </Card>
        </AccordionItem>

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

        {/* Exclusion Rules */}
        <AccordionItem value="exclusionRules" className="border-none">
          <Card>
            <CardHeader className="pb-4">
              <AccordionTrigger className="hover:no-underline py-0">
                <div className="flex items-center gap-2">
                  <EyeOff className="h-5 w-5" />
                  <div className="text-left">
                    <CardTitle className="text-lg">{t('settings.exclusionRules')}</CardTitle>
                    <CardDescription>{t('settings.exclusionRulesDesc')}</CardDescription>
                  </div>
                </div>
              </AccordionTrigger>
            </CardHeader>
            <AccordionContent>
              <CardContent className="pt-4">
                <div className="flex justify-start gap-2 mb-4">
                <Dialog open={addExclRuleOpen} onOpenChange={setAddExclRuleOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-2" />{t('settings.addExclusionRule')}</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{t('settings.addExclusionRule')}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>{t('settings.keyword')}</Label>
                        <Input value={newExclKeyword} onChange={e => setNewExclKeyword(e.target.value)} placeholder={t('settings.keywordPlaceholder')} />
                        <p className="text-xs text-muted-foreground">{t('settings.keywordDesc')}</p>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('settings.matchType')}</Label>
                        <Select value={newExclMatchType} onValueChange={setNewExclMatchType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contains">{t('settings.contains')}</SelectItem>
                            <SelectItem value="exact">{t('settings.exactMatch')}</SelectItem>
                            <SelectItem value="starts_with">{t('settings.startsWith')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="new-excl-rule-apply" checked={newExclApplyExisting} onCheckedChange={(v) => setNewExclApplyExisting(!!v)} />
                        <Label htmlFor="new-excl-rule-apply" className="text-sm font-normal cursor-pointer">{t('settings.applyExclToExisting')}</Label>
                      </div>
                      <Button
                        className="w-full"
                        disabled={!newExclKeyword.trim() || createExclusionRuleMutation.isPending}
                        onClick={async () => {
                          try {
                            await createExclusionRuleMutation.mutateAsync({
                              keyword: newExclKeyword.trim(),
                              match_type: newExclMatchType,
                              apply_to_existing: newExclApplyExisting,
                            });
                            toast.success(t('settings.exclusionRuleCreated'));
                            setNewExclKeyword('');
                            setNewExclMatchType('contains');
                            setNewExclApplyExisting(false);
                            setAddExclRuleOpen(false);
                          } catch (e: any) {
                            toast.error(e.message || t('settings.failedCreateExclusionRule'));
                          }
                        }}
                      >
                        {createExclusionRuleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {t('settings.createExclusionRule')}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={applyAllExclPreviewOpen} onOpenChange={(open) => {
                  setApplyAllExclPreviewOpen(open);
                  if (!open) { setApplyAllExclPreview(null); }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={exclusionRules.length === 0 || applyingAllExclRules} onClick={async () => {
                      setApplyAllExclPreviewOpen(true);
                      setApplyAllExclPreviewLoading(true);
                      setApplyAllExclPreview(null);
                      try {
                        const res = await exclusionRulesApi.previewApplyAll(plaidEnvironment);
                        setApplyAllExclPreview(res?.data?.transactions ?? []);
                      } catch {
                        setApplyAllExclPreview([]);
                      } finally {
                        setApplyAllExclPreviewLoading(false);
                      }
                    }}>
                      {applyingAllExclRules ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                      {t('settings.applyAllExclusionRules')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                      <DialogTitle>{t('settings.applyAllExclusionRulesTitle')}</DialogTitle>
                    </DialogHeader>
                    {applyAllExclPreviewLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">{t('settings.applyAllRulesLoading')}</span>
                      </div>
                    ) : applyAllExclPreview && applyAllExclPreview.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">{t('settings.applyAllExclusionRulesNoChanges')}</p>
                    ) : applyAllExclPreview ? (
                      <>
                        <p className="text-sm text-muted-foreground">{t('settings.applyAllExclusionRulesPreviewDesc')}</p>
                        <p className="text-sm font-medium">{t('settings.applyAllExclusionRulesCount', { count: applyAllExclPreview.length })}</p>
                        <div className="flex-1 overflow-auto border rounded-md">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50 sticky top-0">
                              <tr className="border-b">
                                <th className="text-left p-2 font-medium">{t('transactions.date')}</th>
                                <th className="text-left p-2 font-medium">{t('transactions.description')}</th>
                                <th className="text-right p-2 font-medium">{t('transactions.amount')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {applyAllExclPreview.map((tx) => (
                                <tr key={tx.id} className="border-b last:border-0">
                                  <td className="p-2 whitespace-nowrap">{tx.date}</td>
                                  <td className="p-2 truncate max-w-[300px]">{tx.merchant_name || tx.name}</td>
                                  <td className="p-2 text-right whitespace-nowrap">${Math.abs(tx.amount).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : null}
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setApplyAllExclPreviewOpen(false)}>{t('common.cancel')}</Button>
                      <Button
                        disabled={applyAllExclPreviewLoading || !applyAllExclPreview || applyAllExclPreview.length === 0 || applyingAllExclRules}
                        onClick={async () => {
                          setApplyingAllExclRules(true);
                          try {
                            const res = await exclusionRulesApi.applyAll(plaidEnvironment);
                            const count = res?.data?.applied_count ?? 0;
                            toast.success(t('settings.applyAllExclusionRulesSuccess', { count }));
                            queryClient.invalidateQueries({ queryKey: ['transactions'] });
                            setApplyAllExclPreviewOpen(false);
                          } catch (e: any) {
                            toast.error(e.message || t('settings.applyAllExclusionRulesFailed'));
                          } finally {
                            setApplyingAllExclRules(false);
                          }
                        }}
                      >
                        {applyingAllExclRules && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {t('settings.applyAllExclusionRulesConfirm')}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                </div>
                {exclusionRules.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t('settings.noExclusionRulesYet')}</p>
                ) : (
                  <div className="space-y-2">
                    {exclusionRules.map((rule: any) => (
                      <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                        <div className="flex items-center gap-3 min-w-0">
                          <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium font-mono text-sm">{rule.keyword}</span>
                              <Badge variant="outline" className="text-xs shrink-0">{rule.match_type}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              setEditExclRuleId(rule.id);
                              setEditExclKeyword(rule.keyword);
                              setEditExclMatchType(rule.match_type);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={async () => {
                              if (!confirm(t('settings.deleteExclusionRuleConfirm', { keyword: rule.keyword }))) return;
                              try {
                                await deleteExclusionRuleMutation.mutateAsync(rule.id);
                                toast.success(t('settings.exclusionRuleDeleted'));
                              } catch (e: any) {
                                toast.error(e.message || t('settings.failedDeleteExclusionRule'));
                              }
                            }}
                            disabled={deleteExclusionRuleMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* Edit Exclusion Rule Dialog */}
        <Dialog open={!!editExclRuleId} onOpenChange={(open) => { if (!open) setEditExclRuleId(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('settings.editExclusionRule')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('settings.keyword')}</Label>
                <Input value={editExclKeyword} onChange={e => setEditExclKeyword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.matchType')}</Label>
                <Select value={editExclMatchType} onValueChange={setEditExclMatchType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">{t('settings.contains')}</SelectItem>
                    <SelectItem value="exact">{t('settings.exactMatch')}</SelectItem>
                    <SelectItem value="starts_with">{t('settings.startsWith')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="edit-excl-rule-apply" checked={editExclApplyExisting} onCheckedChange={(v) => setEditExclApplyExisting(!!v)} />
                <Label htmlFor="edit-excl-rule-apply" className="text-sm font-normal cursor-pointer">{t('settings.applyExclToExisting')}</Label>
              </div>
              <Button
                className="w-full"
                disabled={!editExclKeyword.trim() || updateExclusionRuleMutation.isPending}
                onClick={async () => {
                  try {
                    await updateExclusionRuleMutation.mutateAsync({
                      id: editExclRuleId!,
                      keyword: editExclKeyword.trim(),
                      match_type: editExclMatchType,
                      apply_to_existing: editExclApplyExisting,
                    });
                    toast.success(t('settings.exclusionRuleUpdated'));
                    setEditExclRuleId(null);
                    setEditExclApplyExisting(false);
                  } catch (e: any) {
                    toast.error(e.message || t('settings.failedUpdateExclusionRule'));
                  }
                }}
              >
                {updateExclusionRuleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('settings.saveExclusionRule')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <AccordionItem value="preferences" className="border-none">
          <Card>
            <CardHeader className="pb-4">
              <AccordionTrigger className="hover:no-underline py-0">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5" />
                  <div className="text-left">
                    <CardTitle className="text-lg">{t('settings.preferences')}</CardTitle>
                    <CardDescription>{t('settings.customizeExperience')}</CardDescription>
                  </div>
                </div>
              </AccordionTrigger>
            </CardHeader>
            <AccordionContent>
              <CardContent className="pt-4 space-y-6">
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
                  <div>
                    <p className="font-medium">{t('settings.theme')}</p>
                    <p className="text-sm text-muted-foreground">{t('settings.themeDesc')}</p>
                  </div>
                  <Select value={themeMode} onValueChange={(v) => setThemeMode(v as 'light' | 'dark' | 'system')}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t('settings.themeLight')}</SelectItem>
                      <SelectItem value="dark">{t('settings.themeDark')}</SelectItem>
                      <SelectItem value="system">{t('settings.themeSystem')}</SelectItem>
                    </SelectContent>
                  </Select>
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
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* Plaid Environment - for non-admin users with sandbox access */}
        {canUseSandbox && !isAdmin && (
          <AccordionItem value="plaidEnv" className="border-none">
            <Card>
              <CardHeader className="pb-4">
                <AccordionTrigger className="hover:no-underline py-0">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    <div className="text-left">
                      <CardTitle className="text-lg">{t('settings.plaidEnvironment')}</CardTitle>
                      <CardDescription>{t('settings.plaidEnvDescription')}</CardDescription>
                    </div>
                  </div>
                </AccordionTrigger>
              </CardHeader>
              <AccordionContent>
                <CardContent className="pt-4">
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
                  <p className="text-xs text-muted-foreground mt-3">{t('settings.envSeparate')}</p>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        )}

        {/* Privacy & Consent */}
        <AccordionItem value="privacy" className="border-none">
          <Card>
            <CardHeader className="pb-4">
              <AccordionTrigger className="hover:no-underline py-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  <div className="text-left">
                    <CardTitle className="text-lg">{t('consent.privacyTitle')}</CardTitle>
                    <CardDescription>{t('consent.privacyDescription')}</CardDescription>
                  </div>
                </div>
              </AccordionTrigger>
            </CardHeader>
            <AccordionContent>
              <CardContent className="pt-4 space-y-4">
                <PrivacyConsentSettings />
                <Separator />
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <h4 className="text-sm font-semibold mb-3">{t('settings.policies', 'Policies')}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Link to="/privacy" className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      {t('privacy.viewPolicy')}
                    </Link>
                    <Link to="/security-policy" className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      {t('securityPolicy.viewPolicy')}
                    </Link>
                    <Link to="/access-control-policy" className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      {t('accessControlPolicy.viewPolicy')}
                    </Link>
                    <Link to="/data-retention-policy" className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      {t('dataRetentionPolicy.viewPolicy')}
                    </Link>
                  </div>
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* Data Export */}
        <AccordionItem value="export" className="border-none">
          <Card>
            <CardHeader className="pb-4">
              <AccordionTrigger className="hover:no-underline py-0">
                <div className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  <div className="text-left">
                    <CardTitle className="text-lg">{t('settings.dataExport')}</CardTitle>
                    <CardDescription>{t('settings.exportData')}</CardDescription>
                  </div>
                </div>
              </AccordionTrigger>
            </CardHeader>
            <AccordionContent>
              <CardContent className="pt-4 space-y-4">
                <div className="flex gap-4">
                  <ExportDialog format="csv" />
                  <ExportDialog format="json" />
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>
    </AppLayout>
  );
};

function RuleCategoryPicker({ categories, value, onChange }: { categories: Category[]; value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation();

  const parentCategories = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  const selectedCat = categories.find(c => c.id === value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={t('settings.selectCategory')}>
          {selectedCat ? (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: selectedCat.color }} />
              <span>{selectedCat.name}</span>
            </div>
          ) : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {parentCategories.map(cat => {
          const children = getChildren(cat.id);
          return (
            <div key={cat.id}>
              <SelectItem value={cat.id}>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </div>
              </SelectItem>
              {children.map(child => (
                <SelectItem key={child.id} value={child.id}>
                  <div className="flex items-center gap-2 pl-4">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: child.color }} />
                    {child.name}
                  </div>
                </SelectItem>
              ))}
            </div>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export default Settings;
