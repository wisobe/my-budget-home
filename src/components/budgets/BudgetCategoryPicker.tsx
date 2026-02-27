import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Category } from '@/types';

interface Props {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
}

export function BudgetCategoryPicker({ categories, value, onChange }: Props) {
  const { t } = useTranslation();

  const expenseCategories = categories.filter(c => !c.is_income);
  const parentCategories = expenseCategories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => expenseCategories.filter(c => c.parent_id === parentId);

  // Build flat ordered list: parent, then its children, then next parent…
  const orderedItems: { category: Category; isChild: boolean }[] = [];
  for (const parent of parentCategories) {
    orderedItems.push({ category: parent, isChild: false });
    for (const child of getChildren(parent.id)) {
      orderedItems.push({ category: child, isChild: true });
    }
  }

  const selected = categories.find(c => c.id === value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        {selected ? (
          <div className="flex items-center gap-2 truncate">
            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: selected.color }} />
            <span className="truncate">{selected.name}</span>
          </div>
        ) : (
          <SelectValue placeholder={t('budgets.selectCategory')} />
        )}
      </SelectTrigger>
      <SelectContent>
        {orderedItems.map(({ category, isChild }) => (
          <SelectItem key={category.id} value={category.id}>
            <div className="flex items-center gap-2" style={{ paddingLeft: isChild ? '1rem' : 0 }}>
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
              <span className={isChild ? '' : 'font-medium'}>{category.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
