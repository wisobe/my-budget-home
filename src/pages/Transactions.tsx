import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { TransactionList } from '@/components/transactions/TransactionList';
import { SyncButton } from '@/components/transactions/SyncButton';
import { AddTransactionDialog } from '@/components/transactions/AddTransactionDialog';
import { Button } from '@/components/ui/button';
import { Download, Plus } from 'lucide-react';

const Transactions = () => {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <AppLayout
      title="Transactions"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
          <SyncButton />
        </div>
      }
    >
      <TransactionList />
      <AddTransactionDialog open={addOpen} onOpenChange={setAddOpen} />
    </AppLayout>
  );
};

export default Transactions;
