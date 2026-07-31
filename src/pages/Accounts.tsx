import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAccounts, useAllAccountsBalance, useUpdateAccount } from '@/hooks/use-accounts';
import { SyncButton } from '@/components/transactions/SyncButton';
import { Plus, CreditCard, Wallet, PiggyBank, TrendingUp, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import { usePreferences } from '@/contexts/PreferencesContext';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Account } from '@/types';

const accountTypeColors: Record<string, string> = {
  checking: 'bg-primary/10 text-primary',
  savings: 'bg-income/10 text-income',
  credit: 'bg-expense/10 text-expense',
  investment: 'bg-chart-3/10 text-chart-3',
  depository: 'bg-primary/10 text-primary',
  loan: 'bg-expense/10 text-expense',
  other: 'bg-muted text-muted-foreground',
};

const accountIcons: Record<string, typeof Wallet> = {
  checking: Wallet,
  savings: PiggyBank,
  credit: CreditCard,
  investment: TrendingUp,
  depository: Wallet,
  loan: CreditCard,
  other: Wallet,
};

function SortableAccountItem({
  account,
  onToggleExcluded,
  isPending,
  t,
}: {
  account: Account;
  onToggleExcluded: (id: string, excluded: boolean) => void;
  isPending: boolean;
  t: (key: string, opts?: any) => string;
}) {
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
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between p-4 rounded-lg transition-colors group/account",
        account.excluded
          ? "bg-muted/30 opacity-60"
          : "bg-muted/50 hover:bg-muted",
        isDragging && "shadow-lg ring-2 ring-primary/20"
      )}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <Switch
          checked={!account.excluded}
          onCheckedChange={() => onToggleExcluded(account.id, !!account.excluded)}
          disabled={isPending}
          aria-label={t('accounts.toggleInclude')}
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{account.name}</p>
          <p className="text-sm text-muted-foreground truncate">
            {account.institution_name}
            {account.last_synced && (
              <> • {t('accounts.lastSynced', { date: new Date(account.last_synced).toLocaleDateString() })}</>
            )}
            {account.excluded && (
              <> • <span className="text-muted-foreground italic">{t('accounts.excludedLabel')}</span></>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className={cn("font-semibold", Number(account.current_balance) < 0 && "text-expense")}>
            {new Intl.NumberFormat('en-CA', { style: 'currency', currency: account.currency }).format(Number(account.current_balance))}
          </p>
          {account.available_balance !== undefined && (
            <p className="text-xs text-muted-foreground">
              {t('accounts.available', {
                amount: new Intl.NumberFormat('en-CA', { style: 'currency', currency: account.currency }).format(account.available_balance)
              })}
            </p>
          )}
        </div>
        <button
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover/account:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing p-1 text-muted-foreground touch-none"
          tabIndex={-1}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SortableGroupCard({
  type,
  typeAccounts,
  sensors,
  onAccountDragEnd,
  onToggleExcluded,
  isPending,
  t,
}: {
  type: string;
  typeAccounts: Account[];
  sensors: ReturnType<typeof useSensors>;
  onAccountDragEnd: (type: string) => (event: DragEndEvent) => void;
  onToggleExcluded: (id: string, excluded: boolean) => void;
  isPending: boolean;
  t: (key: string, opts?: any) => string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: type });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  const Icon = accountIcons[type] || Wallet;
  const colorClass = accountTypeColors[type] || accountTypeColors.other;
  const typeTotal = typeAccounts
    .filter(a => !a.excluded)
    .reduce((sum, a) => sum + Number(a.current_balance || 0), 0);

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={cn(isDragging && "shadow-lg ring-2 ring-primary/20")}>
        <CardHeader>
          <div className="flex items-center justify-between group/group-card">
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", colorClass)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="capitalize">{t('accounts.accounts', { type })}</CardTitle>
                <CardDescription>{t('accounts.accountCount', { count: typeAccounts.length })}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className={cn("text-xl font-bold", typeTotal < 0 && "text-expense")}>
                {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(typeTotal)}
              </p>
              <button
                {...attributes}
                {...listeners}
                className="opacity-0 group-hover/group-card:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing p-1 text-muted-foreground touch-none"
                tabIndex={-1}
              >
                <GripVertical className="h-5 w-5" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onAccountDragEnd(type)}
          >
            <SortableContext
              items={typeAccounts.map(a => a.id)}
              strategy={verticalListSortingStrategy}
            >
              {typeAccounts.map(account => (
                <SortableAccountItem
                  key={account.id}
                  account={account}
                  onToggleExcluded={onToggleExcluded}
                  isPending={isPending}
                  t={t}
                />
              ))}
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>
    </div>
  );
}

const Accounts = () => {
  const { t } = useTranslation();
  const { data: accountsData, isLoading } = useAccounts();
  const totalBalance = useAllAccountsBalance();
  const updateAccountMutation = useUpdateAccount();
  const { accountOrder, setAccountOrder, accountGroupOrder, setAccountGroupOrder } = usePreferences();

  const accounts = accountsData?.data || [];

  // Sort accounts by saved order
  const sortedAccounts = [...accounts].sort((a, b) => {
    const aIdx = accountOrder.indexOf(String(a.id));
    const bIdx = accountOrder.indexOf(String(b.id));
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  const groupedAccounts = sortedAccounts.reduce((acc, account) => {
    if (!acc[account.type]) acc[account.type] = [];
    acc[account.type].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  // Sort groups by saved group order
  const groupTypes = Object.keys(groupedAccounts);
  const sortedGroupTypes = [...groupTypes].sort((a, b) => {
    const aIdx = accountGroupOrder.indexOf(a);
    const bIdx = accountGroupOrder.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleToggleExcluded = async (accountId: string, currentExcluded: boolean) => {
    try {
      await updateAccountMutation.mutateAsync({ id: accountId, excluded: !currentExcluded });
      toast.success(t(!currentExcluded ? 'accounts.accountExcluded' : 'accounts.accountIncluded'));
    } catch (err: any) {
      toast.error(err.message || t('accounts.failedUpdate'));
    }
  };

  const handleAccountDragEnd = (type: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const typeAccounts = groupedAccounts[type];
    const oldIndex = typeAccounts.findIndex(a => a.id === active.id);
    const newIndex = typeAccounts.findIndex(a => a.id === over.id);
    const reordered = arrayMove(typeAccounts, oldIndex, newIndex);

    const newSorted = sortedAccounts.filter(a => a.type !== type);
    const insertIdx = sortedAccounts.findIndex(a => a.type === type);
    newSorted.splice(insertIdx >= 0 ? insertIdx : newSorted.length, 0, ...reordered);

    setAccountOrder(newSorted.map(a => String(a.id)));
  };

  const handleGroupDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedGroupTypes.indexOf(String(active.id));
    const newIndex = sortedGroupTypes.indexOf(String(over.id));
    const newOrder = arrayMove(sortedGroupTypes, oldIndex, newIndex);
    setAccountGroupOrder(newOrder);
  };

  return (
    <AppLayout
      title={t('accounts.title')}
      actions={
        <div className="flex gap-2">
          <SyncButton />
          <Button size="sm" onClick={() => setManualAccountOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('accounts.addAccount')}
          </Button>
          <AddManualAccountDialog open={manualAccountOpen} onOpenChange={setManualAccountOpen} />
        </div>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardDescription>{t('accounts.totalBalance')}</CardDescription>
            <CardTitle className="text-4xl">
              {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(totalBalance)}
            </CardTitle>
          </CardHeader>
        </Card>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleGroupDragEnd}
        >
          <SortableContext
            items={sortedGroupTypes}
            strategy={verticalListSortingStrategy}
          >
            {sortedGroupTypes.map(type => (
              <SortableGroupCard
                key={type}
                type={type}
                typeAccounts={groupedAccounts[type]}
                sensors={sensors}
                onAccountDragEnd={handleAccountDragEnd}
                onToggleExcluded={handleToggleExcluded}
                isPending={updateAccountMutation.isPending}
                t={t}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </AppLayout>
  );
};

export default Accounts;
