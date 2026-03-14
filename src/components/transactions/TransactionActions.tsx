import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, MoreHorizontal, Split } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Transaction } from '@/types';

interface TransactionActionsProps {
  transaction: Transaction;
  hasSplits: boolean;
  isExcluded: boolean;
  onSplit: (transaction: Transaction) => void;
  onToggleExclude: (transaction: Transaction) => void;
}

export function TransactionActions({
  transaction,
  hasSplits,
  isExcluded,
  onSplit,
  onToggleExclude,
}: TransactionActionsProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const actionsLabel = t('transactions.actions', { defaultValue: 'Transaction actions' });

  const openMobileActions = (
    event: React.MouseEvent<HTMLButtonElement> | React.PointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    setMobileOpen(true);
  };

  if (isMobile) {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 w-10 min-h-[44px] min-w-[44px] p-0 touch-manipulation"
          aria-label={actionsLabel}
          onPointerDown={(event) => {
            if (event.pointerType === 'touch' || event.pointerType === 'pen') {
              event.preventDefault();
              openMobileActions(event);
            }
          }}
          onClick={(event) => openMobileActions(event)}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">{actionsLabel}</span>
        </Button>

        <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
          <DrawerContent className="z-[120]">
            <DrawerHeader className="text-left">
              <DrawerTitle className="text-base">{transaction.name}</DrawerTitle>
              <DrawerDescription>
                {t('transactions.chooseAction', { defaultValue: 'Choose an action for this transaction' })}
              </DrawerDescription>
            </DrawerHeader>
            <div className="space-y-2 px-4 pb-4">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] w-full justify-start"
                onClick={() => {
                  onSplit(transaction);
                  setMobileOpen(false);
                }}
              >
                <Split className="mr-2 h-4 w-4" />
                {hasSplits ? t('transactions.editSplit') : t('transactions.split')}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] w-full justify-start"
                onClick={() => {
                  onToggleExclude(transaction);
                  setMobileOpen(false);
                }}
              >
                {isExcluded ? (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    {t('transactions.include')}
                  </>
                ) : (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    {t('transactions.exclude')}
                  </>
                )}
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 w-10 min-h-[44px] min-w-[44px] p-0 touch-manipulation"
          aria-label={actionsLabel}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">{actionsLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" sideOffset={4} className="z-[100]">
        <DropdownMenuItem onSelect={() => onSplit(transaction)}>
          <Split className="mr-2 h-4 w-4" />
          {hasSplits ? t('transactions.editSplit') : t('transactions.split')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onToggleExclude(transaction)}>
          {isExcluded ? (
            <>
              <Eye className="mr-2 h-4 w-4" /> {t('transactions.include')}
            </>
          ) : (
            <>
              <EyeOff className="mr-2 h-4 w-4" /> {t('transactions.exclude')}
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
