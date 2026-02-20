import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useUpdateCategory, useCategories } from '@/hooks/use-transactions';
import { toast } from '@/components/ui/sonner';
import type { Category } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
}

export function EditCategoryDialog({ open, onOpenChange, category }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6b7280');
  const [isIncome, setIsIncome] = useState(false);
  const [parentId, setParentId] = useState('none');
  const updateMutation = useUpdateCategory();
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.data || [];

  useEffect(() => {
    if (category) {
      setName(category.name);
      setColor(category.color);
      setIsIncome(!!category.is_income);
      setParentId(category.parent_id || 'none');
    }
  }, [category]);

  if (!category) return null;

  const hasChildren = categories.some(c => c.parent_id === category.id);
  const availableParents = categories.filter(c => !c.parent_id && c.id !== category.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        id: category.id,
        name: name.trim(),
        color,
        is_income: isIncome,
        parent_id: parentId === 'none' ? null : parentId,
      });
      toast.success(t('settings_categories.categoryUpdated'));
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || t('settings_categories.failedUpdateCategory'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('settings_categories.editCategory')}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('settings.categoryName')}</Label>
            <Input value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>{t('settings.color')}</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
              <Input value={color} onChange={e => setColor(e.target.value)} className="flex-1" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isIncome} onCheckedChange={setIsIncome} />
            <Label>{t('settings.incomeCategory')}</Label>
          </div>
          {!hasChildren && (
            <div className="space-y-2">
              <Label>{t('settings_categories.parentCategory')}</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger><SelectValue placeholder={t('settings_categories.noParent')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('settings_categories.noParent')}</SelectItem>
                  {availableParents.map(c => (
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
          )}
          <Button type="submit" className="w-full" disabled={updateMutation.isPending || !name.trim()}>
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('common.save')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
