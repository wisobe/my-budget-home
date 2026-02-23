import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCategories } from '@/hooks/use-transactions';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface Props {
  value: string | null | undefined;
  categoryName?: string;
  categoryColor?: string;
  onSelect: (categoryId: string) => void;
}

export function CategoryPicker({ value, categoryName, categoryColor, onSelect }: Props) {
  const { t } = useTranslation();
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.data || [];
  const [open, setOpen] = useState(false);
  const [expandedParent, setExpandedParent] = useState<string | null>(null);

  const parentCategories = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  const handleSelect = (categoryId: string) => {
    onSelect(categoryId);
    setOpen(false);
    setExpandedParent(null);
  };

  const toggleExpand = (parentId: string) => {
    setExpandedParent(prev => prev === parentId ? null : parentId);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setExpandedParent(null); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-[150px] justify-start font-normal h-9 px-3">
          {value && categoryName ? (
            <div className="flex items-center gap-2 truncate">
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: categoryColor || '#6b7280' }} />
              <span className="truncate">{categoryName}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{t('transactions.select')}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-1 max-h-[var(--radix-popover-content-available-height,400px)] overflow-y-auto" align="start" side="bottom" collisionPadding={8}>
        {/* None option */}
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-muted transition-colors text-left"
          onClick={() => handleSelect('none')}
        >
          <span className="text-muted-foreground">{t('transactions.noneRemove')}</span>
        </button>

        {/* Parent categories with inline children */}
        {parentCategories.map(cat => {
          const children = getChildren(cat.id);
          const hasChildren = children.length > 0;
          const isExpanded = expandedParent === cat.id;

          return (
            <div key={cat.id}>
              <button
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
                  {/* Select parent itself */}
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors text-left font-medium"
                    onClick={() => handleSelect(cat.id)}
                  >
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    {cat.name}
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
      </PopoverContent>
    </Popover>
  );
}
