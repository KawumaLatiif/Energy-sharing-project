'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Filter,
  Download,
  Plus,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MoreVertical
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { authFetch } from '@/lib/auth';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { get } from '@/lib/fetch';

interface Loan {
  id: number;
  loan_number: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
  amount_requested: number;
  amount_approved: number;
  interest_rate: number;
  loan_tier: string;
  monthly_payment: number;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed' | 'defaulted';
  // purpose: string;
  created_at: string;
  approved_at: string | null;
  disbursed_at: string | null;
  next_payment_date: string | null;
  remaining_balance: number;
}

export default function LoansManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLoans, setTotalLoans] = useState(0);
  const limit = 10;

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
              page: currentPage.toString(),
              limit: limit.toString(),
              ...(search && { search })
            });
      
            const res = await get<any>(`admin/loans/?${params}`);
            
      
            if (res.status === 403 || res.status === 401) {
              router.push('/dashboard');
              return;
            }
      
            if (res.error) throw new Error('Failed to fetch loans');
            if(res.data && res.data.loans){
              console.log('Data is ested as', res.data.loans);
            // const data = await res.json();
            setLoans(res.data.loans);
            setTotalPages(res.data.pagination.pages);
            setTotalLoans(res.data.pagination.total);
            }
            else if (res.data){
              console.log('data is flat', res.data);
              setLoans(res.data.loans);
            setTotalPages(res.data.pagination.pages);
            setTotalLoans(res.data.pagination.total);
            } else {
                console.error('No data in response');
              }
      
    } catch (error) {
      console.error('Error fetching loans:', error);
      toast({
        title: 'Error',
        description: 'Failed to load loans',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  // const getStatusBadge = (status: Loan['status']) => {
  //   const variants = {
  //     pending: { variant: "secondary" as const, icon: Clock },
  //     approved: { variant: "success" as const, icon: CheckCircle },
  //     rejected: { variant: "destructive" as const, icon: XCircle },
  //     active: { variant: "default" as const, icon: DollarSign },
  //     completed: { variant: "outline" as const, icon: CheckCircle },
  //     defaulted: { variant: "destructive" as const, icon: AlertCircle },
  //   };
    
  //   const { variant, icon: Icon } = variants[status];
  //   const statusText = status.charAt(0).toUpperCase() + status.slice(1);
    
  //   return (
  //     <Badge variant={variant} className="gap-1">
  //       <Icon className="h-3 w-3" />
  //       {statusText}
  //     </Badge>
  //   );
  // };

  const exportLoans = () => {
    const csvContent = [
      ['Loan Number', 'Customer', 'Amount', 'Disbursed', 'Status', 'Purpose', 'Created', 'Next Payment'],
      ...loans.map(loan => [
        loan.loan_number,
        loan.user.name,
        `USh ${loan.amount_requested.toLocaleString()}`,
        `USh ${loan.amount_approved.toLocaleString()}`,
        loan.status.charAt(0).toUpperCase() + loan.status.slice(1),
        // loan.purpose,
        new Date(loan.created_at).toLocaleDateString(),
        // loan.next_payment_date ? new Date(loan.next_payment_date).toLocaleDateString() : 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loans_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const approveLoan = (loanId: number) => {
    // TODO: Implement API call
    toast({
      title: 'Loan Approved',
      description: 'The loan has been approved successfully',
    });
    fetchLoans();
  };

  const rejectLoan = (loanId: number) => {
    // TODO: Implement API call
    toast({
      title: 'Loan Rejected',
      description: 'The loan has been rejected',
    });
    fetchLoans();
  };

  useEffect(() => {
    fetchLoans();
  }, [search, statusFilter]);

  if (loading && loans.length === 0) {
    return <LoansManagementSkeleton />;
  }

  const statusStats = {
    pending: loans.filter(l => l.status === 'pending').length,
    active: loans.filter(l => l.status === 'active').length,
    completed: loans.filter(l => l.status === 'completed').length,
    defaulted: loans.filter(l => l.status === 'defaulted').length,
    total: loans.length,
    totalAmount: loans.reduce((acc, loan) => acc + loan.amount_requested, 0),
    disbursedAmount: loans.reduce((acc, loan) => acc + loan.amount_approved, 0),
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Management</h1>
          <p className="text-muted-foreground">
            Manage all loan applications and disbursements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportLoans}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Loan
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusStats.total}</div>
            <p className="text-sm text-muted-foreground">
              USh {statusStats.totalAmount.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusStats.pending}</div>
            <p className="text-sm text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusStats.active}</div>
            <p className="text-sm text-muted-foreground">
              USh {loans.filter(l => l.status === 'active').reduce((acc, loan) => acc + loan.remaining_balance, 0).toLocaleString()} outstanding
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Amount Disbursed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              USh {statusStats.disbursedAmount.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">
              {((statusStats.disbursedAmount / statusStats.totalAmount) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search loans by number, customer, or purpose..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Loans</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="defaulted">Defaulted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan Details</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Timeline</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium font-mono">{loan.loan_number}</span>
                        {/* <span className="text-sm text-muted-foreground">
                          {loan.purpose}
                        </span> */}
                        {/* <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs">
                            {loan.duration_months} months @ {loan.interest_rate}%
                          </span>
                        </div> */}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{loan.user.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {loan.user.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          USh {loan.amount_requested.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Disbursed: USh {loan.amount_approved.toLocaleString()}
                        </span>
                        {loan.status === 'active' && (
                          <span className="text-xs text-muted-foreground">
                            Balance: USh {loan.loan_tier}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {loan.loan_tier}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">
                          Created: {new Date(loan.created_at).toLocaleDateString()}
                        </span>
                        {/* {loan.approved_at && (
                          <span className="text-sm text-muted-foreground">
                            Approved: {new Date(loan.approved_at).toLocaleDateString()}
                          </span>
                        )}
                        {loan.next_payment_date && (
                          <span className="text-sm font-medium">
                            Next Payment: {new Date(loan.next_payment_date).toLocaleDateString()}
                          </span>
                        )} */}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {loan.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => approveLoan(loan.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejectLoan(loan.id)}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {loan.status === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/admin/loans/${loan.id}`)}
                          >
                            View
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {loans.length === 0 && !loading && (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No loans found</p>
              <Button className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create New Loan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoansManagementSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-4 w-32 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-48" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}