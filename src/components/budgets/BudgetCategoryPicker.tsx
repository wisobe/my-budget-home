import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Category } from '@/types';

interface Props {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
}

export function BudgetCategoryPicker({ categories, value, onChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [expandedParent, setExpandedParent] = useState<string | null>(null);

  const expenseCategories = categories.filter(c => !c.is_income);
  const parentCategories = expenseCategories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => expenseCategories.filter(c => c.parent_id === parentId);

  const selected = categories.find(c => c.id === value);

  const handleSelect = (categoryId: string) => {
    onChange(categoryId);
    setOpen(false);
    setExpandedParent(null);
  };

  const toggleExpand = (parentId: string) => {
    setExpandedParent(prev => (prev === parentId ? null : parentId));
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setExpandedParent(null); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {selected ? (
            <div className="flex items-center gap-2 truncate">
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: selected.color }} />
              <span className="truncate">{selected.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{t('budgets.selectCategory')}</span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-1 max-h-[var(--radix-popover-content-available-height,300px)] overflow-y-auto"
        align="start"
        side="bottom"
        collisionPadding={8}
      >
        {parentCategories.map(cat => {
          const children = getChildren(cat.id);
          const hasChildren = children.length > 0;
          const isExpanded = expandedParent === cat.id;

          return (
            <div key={cat.id}>
              <button
                type="button"
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-sm rounded-sm hover:bg-muted transition-colors text-left",
                  isExpanded && "bg-muted"
                )}
                onClick={() => hasChildren ? toggleExpand(cat.id) : handleSelect(cat.id)}
              >
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span>{cat.name}</span>
                </div>
                {hasChildren && (isExpanded
                  ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
              </button>

              {hasChildren && isExpanded && (
                <div className="ml-3 border-l border-border pl-1">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors text-left font-medium"
                    onClick={() => handleSelect(cat.id)}
                  >
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    {cat.name}
                  </button>
                  {children.map(child => (
                    <button
                      type="button"
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
      </PopoverContent>
    </Popover>
  );
}
