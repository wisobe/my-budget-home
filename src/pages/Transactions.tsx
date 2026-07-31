import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout/AppLayout';
import { TransactionList } from '@/components/transactions/TransactionList';
import { SyncButton } from '@/components/transactions/SyncButton';
import { AddTransactionDialog } from '@/components/transactions/AddTransactionDialog';
import { ImportCsvDialog } from '@/components/transactions/ImportCsvDialog';
import { ExportDialog } from '@/components/export/ExportDialog';
import { Button } from '@/components/ui/button';
import { Download, Plus, Upload } from 'lucide-react';

const Transactions = () => {
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <AppLayout
      title={t('transactions.title')}
      actions={
        <div className="flex gap-2">
          <ExportDialog
            format="csv"
            trigger={
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                {t('transactions.export')}
              </Button>
            }
          />
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            {t('transactions.import.button')}
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('transactions.addTransaction')}
          </Button>
          <SyncButton />
        </div>
      }
    >
      <TransactionList />
      <AddTransactionDialog open={addOpen} onOpenChange={setAddOpen} />
      <ImportCsvDialog open={importOpen} onOpenChange={setImportOpen} />

    </AppLayout>
  );
};

export default Transactions;
