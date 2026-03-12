import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccounts } from '@/hooks/use-accounts';
import { CreditCard, Wallet, PiggyBank, TrendingUp, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/contexts/PreferencesContext';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const accountIcons: Record<string, typeof Wallet> = {
  checking: Wallet,
  savings: PiggyBank,
  credit: CreditCard,
  investment: TrendingUp,
  depository: Wallet,
  loan: CreditCard,
  other: Wallet,
};

interface AccountItem {
  id: string;
  name: string;
  institution_name: string;
  type: string;
  current_balance: number | string | null;
  currency: string;
}

function SortableAccount({ account }: { account: AccountItem }) {
  const Icon = accountIcons[account.type] || Wallet;
  const isNegative = Number(account.current_balance) < 0;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: account.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
          account.type === 'credit' ? "bg-expense/10" : "bg-primary/10"
        )}>
          <Icon className={cn(
            "h-5 w-5",
            account.type === 'credit' ? "text-expense" : "text-primary"
          )} />
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{account.name}</p>
          <p className="text-sm text-muted-foreground truncate">{account.institution_name}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <p className={cn(
            "font-semibold",
            isNegative ? "text-expense" : "text-foreground"
          )}>
            {new Intl.NumberFormat('en-CA', { 
              style: 'currency', 
              currency: account.currency 
            }).format(Math.abs(Number(account.current_balance)))}
          </p>
          <p className="text-xs text-muted-foreground capitalize">{account.type}</p>
        </div>
        <button
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing p-1 text-muted-foreground/40 transition-opacity shrink-0"
          tabIndex={-1}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function AccountsList() {
  const { t } = useTranslation();
  const { data: accountsData, isLoading } = useAccounts();
  const { accountOrder, setAccountOrder } = usePreferences();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const accounts = (accountsData?.data || []).filter(a => !a.excluded);

  const sortedAccounts = useMemo(() => {
    if (!accountOrder || accountOrder.length === 0) return accounts;
    const ordered: typeof accounts = [];
    for (const id of accountOrder) {
      const acc = accounts.find(a => String(a.id) === id);
      if (acc) ordered.push(acc);
    }
    for (const acc of accounts) {
      if (!ordered.find(a => String(a.id) === String(acc.id))) ordered.push(acc);
    }
    return ordered;
  }, [accounts, accountOrder]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedAccounts.findIndex(a => String(a.id) === String(active.id));
    const newIndex = sortedAccounts.findIndex(a => String(a.id) === String(over.id));
    const newOrder = arrayMove(sortedAccounts, oldIndex, newIndex);
    setAccountOrder(newOrder.map(a => String(a.id)));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('accounts.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('accounts.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedAccounts.map(a => String(a.id))} strategy={verticalListSortingStrategy}>
            {sortedAccounts.map(account => (
              <SortableAccount key={account.id} account={account as AccountItem} />
            ))}
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}
