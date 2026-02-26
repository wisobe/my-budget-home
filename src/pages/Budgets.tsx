import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Target, Pencil } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { categoriesApi } from '@/lib/api';
import { useBudgets, useSaveBudget, useDeleteBudget } from '@/hooks/use-budgets';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { BudgetCategoryPicker } from '@/components/budgets/BudgetCategoryPicker';
import type { Category, BudgetWithSpent } from '@/types';

function getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'bg-destructive';
  if (percentage >= 75) return 'bg-yellow-500';
  return 'bg-primary';
}

function getProgressBg(percentage: number): string {
  if (percentage >= 100) return 'bg-destructive/20';
  if (percentage >= 75) return 'bg-yellow-500/20';
  return 'bg-primary/20';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
}

export default function Budgets() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithSpent | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<string>('monthly');

  const { data: budgetsRes, isLoading } = useBudgets();
  const { data: categoriesRes } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  });

  const saveBudget = useSaveBudget();
  const deleteBudget = useDeleteBudget();

  const budgets = budgetsRes?.data ?? [];
  const categories: Category[] = categoriesRes?.data ?? [];

  const weeklyBudgets = budgets.filter(b => b.period === 'weekly');
  const monthlyBudgets = budgets.filter(b => b.period === 'monthly');
  const yearlyBudgets = budgets.filter(b => b.period === 'yearly');

  const openAddDialog = () => {
    setEditingBudget(null);
    setSelectedCategory('');
    setAmount('');
    setPeriod('monthly');
    setDialogOpen(true);
  };

  const openEditDialog = (budget: BudgetWithSpent) => {
    setEditingBudget(budget);
    setSelectedCategory(budget.category_id);
    setAmount(String(budget.amount));
    setPeriod(budget.period);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedCategory || !amount || parseFloat(amount) <= 0) return;
    saveBudget.mutate(
      { category_id: selectedCategory, amount: parseFloat(amount), period },
      {
        onSuccess: () => {
          toast({ title: t('budgets.budgetSaved') });
          setDialogOpen(false);
          setEditingBudget(null);
        },
        onError: () => toast({ title: t('budgets.failedSave'), variant: 'destructive' }),
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteBudget.mutate(id, {
      onSuccess: () => toast({ title: t('budgets.budgetDeleted') }),
      onError: () => toast({ title: t('budgets.failedDelete'), variant: 'destructive' }),
    });
  };

  const renderBudgetCard = (budget: BudgetWithSpent) => {
    const pct = Math.min(budget.percentage, 100);
    const remaining = budget.amount - budget.spent;

    return (
      <div key={budget.id} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: budget.category_color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-sm truncate">{budget.category_name}</span>
            <span className="text-xs text-muted-foreground ml-2 shrink-0">
              {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
            </span>
          </div>
          <div className={cn('h-2 rounded-full w-full', getProgressBg(budget.percentage))}>
            <div
              className={cn('h-2 rounded-full transition-all', getProgressColor(budget.percentage))}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className={cn('text-xs', remaining < 0 ? 'text-destructive font-medium' : 'text-muted-foreground')}>
              {remaining >= 0
                ? t('budgets.remaining', { amount: formatCurrency(remaining) })
                : t('budgets.over', { amount: formatCurrency(Math.abs(remaining)) })}
            </span>
            <span className="text-xs text-muted-foreground">{budget.percentage}%</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => openEditDialog(budget)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => handleDelete(budget.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderSection = (title: string, items: BudgetWithSpent[]) => {
    if (items.length === 0) return null;
    const totalBudget = items.reduce((s, b) => s + b.amount, 0);
    const totalSpent = items.reduce((s, b) => s + b.spent, 0);
    const totalPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{title}</CardTitle>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}
              <Badge variant="outline" className="ml-2">{totalPct}%</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map(renderBudgetCard)}
        </CardContent>
      </Card>
    );
  };

  const isEditing = !!editingBudget;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('budgets.title')}</h1>
            <p className="text-muted-foreground">{t('budgets.description')}</p>
          </div>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {t('budgets.addBudget')}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : budgets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">{t('budgets.noBudgets')}</h3>
              <p className="text-muted-foreground mb-4">{t('budgets.noBudgetsDesc')}</p>
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                {t('budgets.addBudget')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {renderSection(t('budgets.weeklyBudgets'), weeklyBudgets)}
            {renderSection(t('budgets.monthlyBudgets'), monthlyBudgets)}
            {renderSection(t('budgets.yearlyBudgets'), yearlyBudgets)}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? t('budgets.editBudget') : t('budgets.addBudget')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('budgets.category')}</Label>
              <BudgetCategoryPicker
                categories={categories}
                value={selectedCategory}
                onChange={setSelectedCategory}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('budgets.amount')}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('budgets.period')}</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">{t('budgets.weekly')}</SelectItem>
                  <SelectItem value="monthly">{t('budgets.monthly')}</SelectItem>
                  <SelectItem value="yearly">{t('budgets.yearly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!selectedCategory || !amount || saveBudget.isPending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
