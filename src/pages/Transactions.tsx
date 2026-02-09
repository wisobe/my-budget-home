import { AppLayout } from '@/components/layout/AppLayout';
import { TransactionList } from '@/components/transactions/TransactionList';
import { SyncButton } from '@/components/transactions/SyncButton';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

const Transactions = () => {
  return (
    <AppLayout
      title="Transactions"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <SyncButton />
        </div>
      }
    >
      <TransactionList />
    </AppLayout>
  );
};

export default Transactions;
