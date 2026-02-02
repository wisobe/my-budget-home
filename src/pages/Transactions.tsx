import { AppLayout } from '@/components/layout/AppLayout';
import { TransactionList } from '@/components/transactions/TransactionList';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download } from 'lucide-react';

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
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync
          </Button>
        </div>
      }
    >
      <TransactionList />
    </AppLayout>
  );
};

export default Transactions;
