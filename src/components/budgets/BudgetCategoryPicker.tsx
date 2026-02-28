import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Category } from '@/types';

interface Props {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
}

export function BudgetCategoryPicker({ categories, value, onChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const expenseCategories = categories.filter(c => !c.is_income);
  const parentCategories = expenseCategories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => expenseCategories.filter(c => c.parent_id === parentId);

  const items: { category: Category; isChild: boolean }[] = [];
  for (const parent of parentCategories) {
    items.push({ category: parent, isChild: false });
    for (const child of getChildren(parent.id)) {
      items.push({ category: child, isChild: true });
    }
  }

  const selected = categories.find(c => c.id === value);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          !selected && 'text-muted-foreground'
        )}
      >
        {selected ? (
          <span className="flex items-center gap-2 truncate">
            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: selected.color }} />
            <span className="truncate">{selected.name}</span>
          </span>
        ) : (
          <span>{t('budgets.selectCategory')}</span>
        )}
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-[9999] mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md max-h-64 overflow-y-auto">
          {items.map(({ category, isChild }) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                onChange(category.id);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer',
                category.id === value && 'bg-accent text-accent-foreground'
              )}
              style={{ paddingLeft: isChild ? '2rem' : undefined }}
            >
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
              <span className={isChild ? '' : 'font-medium'}>{category.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
