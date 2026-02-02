import { useState } from 'react';
import { useTransactions, useCategories, useCategorizeTransaction } from '@/hooks/use-transactions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Search, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export function TransactionList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: transactionsData, isLoading } = useTransactions({
    page,
    per_page: 15,
    search: search || undefined,
    category_id: categoryFilter !== 'all' ? categoryFilter : undefined,
  });

  const { data: categoriesData } = useCategories();
  const categorize = useCategorizeTransaction();

  const transactions = transactionsData?.data || [];
  const categories = categoriesData?.data || [];
  const totalPages = transactionsData?.total_pages || 1;

  const getCategoryById = (id?: string) => {
    if (!id) return null;
    return categories.find(c => c.id === id);
  };

  const handleCategorize = (transactionId: string, categoryId: string) => {
    categorize.mutate({ id: transactionId, category_id: categoryId });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <div className="h-10 bg-muted animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              transactions.map(transaction => {
                const isIncome = transaction.amount < 0;
                const category = getCategoryById(transaction.category_id);

                return (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center",
                        isIncome ? "bg-income/10" : "bg-expense/10"
                      )}>
                        {isIncome ? (
                          <ArrowDownRight className="h-4 w-4 text-income" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-expense" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{transaction.name}</p>
                        {transaction.merchant_name && transaction.merchant_name !== transaction.name && (
                          <p className="text-sm text-muted-foreground">{transaction.merchant_name}</p>
                        )}
                        {transaction.pending && (
                          <Badge variant="outline" className="mt-1 text-xs">Pending</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={transaction.category_id || 'uncategorized'}
                        onValueChange={(value) => handleCategorize(transaction.id, value)}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue>
                            {category ? (
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-3 w-3 rounded-full"
                                  style={{ backgroundColor: category.color }}
                                />
                                {category.name}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Select...</span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-3 w-3 rounded-full"
                                  style={{ backgroundColor: cat.color }}
                                />
                                {cat.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString('en-CA', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "font-semibold",
                        isIncome ? "text-income" : "text-expense"
                      )}>
                        {isIncome ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
