"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import {
  ArrowUpRight,
  CheckCheck,
  Clock10Icon,
  EllipsisVertical,
  PlusCircle,
  XIcon
} from "lucide-react";
import { get } from "@/lib/fetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";

interface Transaction {
  id: number;
  transaction_type: string;
  transaction_type_display: string;
  amount?: number;
  units?: number;
  status: string;
  reference_id?: string;
  details?: any;
  created_at: string;
}

const TransList = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    type: '',
    start_date: '',
    end_date: '',
  });

  const pageSize = 20;

  const fetchTransactions = async (currentPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: pageSize.toString(),
        ...(filters.type && { type: filters.type }),
        ...(filters.start_date && { start_date: filters.start_date }),
        ...(filters.end_date && { end_date: filters.end_date }),
      });

      const response = await get<any>(`transactions/history/?${params.toString()}`);
      if (response.data?.success) {
        setTransactions(response.data.transactions);
        setTotal(response.data.total);
      } else {
        setError('Failed to load transactions');
      }
    } catch (e) {
      setError('Error loading transactions');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(page);
  }, [page, filters]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);  // Reset to first page on filter change
  };

  const getTypeBadge = (type: string) => {
    const colors: { [key: string]: string } = {
      LOAN_APPLICATION: 'bg-blue-500',
      LOAN_REPAYMENT: 'bg-green-500',
      UNIT_PURCHASE: 'bg-yellow-500',
      UNIT_SHARE: 'bg-purple-500',
      // Add more
    };
    return <Badge className={colors[type] || 'bg-gray-500'}>{type.replace('_', ' ')}</Badge>;
  };

  if (loading) return <p>Loading transactions...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="flex flex-col gap-4 w-full">
      <h3 className="text-2xl text-left font-bold tracking-tight p-4">
        Transaction History
      </h3>

      {/* Filters */}
      <div className="flex gap-4">
        <Select onValueChange={(v) => handleFilterChange('type', v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by Type" />
          </SelectTrigger>
          <SelectContent>
            {/* <SelectItem value="">All Types</SelectItem> */}
            <SelectItem value="LOAN_APPLICATION">Loan Application</SelectItem>
            <SelectItem value="LOAN_REPAYMENT">Loan Repayment</SelectItem>
            <SelectItem value="UNIT_PURCHASE">Unit Purchase</SelectItem>
            <SelectItem value="UNIT_SHARE">Unit Share</SelectItem>
            {/* Add more options from TransactionType */}
          </SelectContent>
        </Select>

        <Input
          type="date"
          placeholder="Start Date"
          value={filters.start_date}
          onChange={(e) => handleFilterChange('start_date', e.target.value)}
        />
        <Input
          type="date"
          placeholder="End Date"
          value={filters.end_date}
          onChange={(e) => handleFilterChange('end_date', e.target.value)}
        />
        <Button onClick={() => fetchTransactions(1)}>Apply Filters</Button>
      </div>

      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount/Units</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((txn) => (
            <TableRow key={txn.id}>
              <TableCell>{txn.id}</TableCell>
              <TableCell>{getTypeBadge(txn.transaction_type)}</TableCell>
              <TableCell>
                {txn.amount ? `${txn.amount} UGX` : ''}
                {txn.units ? `${txn.units} units` : ''}
              </TableCell>
              <TableCell>
                <Badge variant={txn.status === 'COMPLETED' ? 'default' : 'destructive'}>
                  {txn.status}
                </Badge>
              </TableCell>
              <TableCell>{txn.created_at}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger><EllipsisVertical /></DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>
                      <Button asChild variant="link"><Link href={`/transactions/${txn.id}`}>View Transaction</Link></Button>
                    </DropdownMenuItem>
                    {txn.reference_id && (
                      <DropdownMenuItem asChild>
                        <Link href={`/details/${txn.transaction_type.toLowerCase()}/${txn.reference_id}`}>View Details</Link>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {transactions.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center">No transactions found</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex justify-between mt-4">
        <Button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
        <span>Page {page} of {Math.ceil(total / pageSize)}</span>
        <Button disabled={page * pageSize >= total} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
};

export default TransList;