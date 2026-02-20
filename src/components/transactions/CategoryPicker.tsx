import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useCategories } from '@/hooks/use-transactions';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
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
  const [hoveredParent, setHoveredParent] = useState<string | null>(null);
  const submenuTimeout = useRef<ReturnType<typeof setTimeout>>();

  const parentCategories = categories.filter(c => !c.parent_id);

  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  const handleSelect = (categoryId: string) => {
    onSelect(categoryId);
    setOpen(false);
    setHoveredParent(null);
  };

  const handleParentEnter = (parentId: string) => {
    if (submenuTimeout.current) clearTimeout(submenuTimeout.current);
    setHoveredParent(parentId);
  };

  const handleParentLeave = () => {
    submenuTimeout.current = setTimeout(() => setHoveredParent(null), 150);
  };

  const handleSubmenuEnter = () => {
    if (submenuTimeout.current) clearTimeout(submenuTimeout.current);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
      <PopoverContent className="w-[200px] p-1" align="start" side="bottom">
        <div className="relative">
          {/* None option */}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-muted transition-colors text-left"
            onClick={() => handleSelect('none')}
          >
            <span className="text-muted-foreground">{t('transactions.noneRemove')}</span>
          </button>

          {/* Parent categories */}
          {parentCategories.map(cat => {
            const children = getChildren(cat.id);
            const hasChildren = children.length > 0;

            return (
              <div
                key={cat.id}
                className="relative"
                onMouseEnter={() => handleParentEnter(cat.id)}
                onMouseLeave={handleParentLeave}
              >
                <button
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-sm hover:bg-muted transition-colors text-left",
                    hoveredParent === cat.id && hasChildren && "bg-muted"
                  )}
                  onClick={() => {
                    if (!hasChildren) handleSelect(cat.id);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span>{cat.name}</span>
                  </div>
                  {hasChildren && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                </button>

                {/* Submenu */}
                {hasChildren && hoveredParent === cat.id && (
                  <div
                    className="absolute left-full top-0 ml-1 w-[180px] bg-popover border rounded-md shadow-md p-1 z-50"
                    onMouseEnter={handleSubmenuEnter}
                    onMouseLeave={handleParentLeave}
                  >
                    {/* Option to select the parent itself */}
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-muted transition-colors text-left font-medium"
                      onClick={() => handleSelect(cat.id)}
                    >
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </button>
                    <div className="h-px bg-border my-1" />
                    {children.map(child => (
                      <button
                        key={child.id}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-muted transition-colors text-left"
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
