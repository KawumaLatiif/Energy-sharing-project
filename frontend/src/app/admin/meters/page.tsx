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
  Search,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Zap,
  User,
  Plus,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { authFetch } from '@/lib/auth';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { get } from '@/lib/fetch';

interface Meter {
  meter_id: number;
  meter_no: string;
  static_ip: string;
  units: number;
  user: {
    id: number;
    email: string;
    name: string;
    phone: string;
    account_active: boolean;
  };
  created_at: string;
  last_updated: string;
}

export default function MetersManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMeters, setTotalMeters] = useState(0);
  const limit = 20;

  const API_BASE = 'http://localhost:8000/api/v1';

  const fetchMeters = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(search && { search })
      });

      const res = await get<any>(`admin/meters/?${params}`);
      

      if (res.status === 403 || res.status === 401) {
        router.push('/dashboard');
        return;
      }

      if (res.error) throw new Error('Failed to fetch meters');
      if(res.data && res.data.meters){
        console.log('Data is ested as', res.data.meters);
      // const data = await res.json();
      setMeters(res.data.meters);
      setTotalPages(res.data.pagination.pages);
      setTotalMeters(res.data.pagination.total);
      }
      else if (res.data){
        console.log('data is flat', res.data);
        setMeters(res.data.meters);
      setTotalPages(res.data.pagination.pages);
      setTotalMeters(res.data.pagination.total);
      } else {
          console.error('No data in response');
        }
    } catch (error) {
      console.error('Error fetching meters:', error);
      toast({
        title: 'Error',
        description: 'Failed to load meters',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshMeterData = async (meterId: number) => {
    try {
      toast({
        title: 'Success',
        description: 'Meter data refresh initiated',
      });
    } catch (error) {
      console.error('Error refreshing meter data:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh meter data',
        variant: 'destructive',
      });
    }
  };

  const exportMeters = () => {
    const csvContent = [
      ['Meter ID', 'Meter Number', 'Static IP', 'Units', 'User', 'User Email', 'Status', 'Created'],
      ...meters.map(meter => [
        meter.meter_id,
        meter.meter_no,
        meter.static_ip,
        meter.units.toString(),
        meter.user.name,
        meter.user.email,
        meter.user.account_active ? 'Active' : 'Inactive',
        new Date(meter.created_at).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meters_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  useEffect(() => {
    fetchMeters();
  }, [currentPage, search]);

  if (loading && meters.length === 0) {
    return <MetersManagementSkeleton />;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meter Management</h1>
          <p className="text-muted-foreground">
            Manage all registered meters ({totalMeters} total)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportMeters}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add New Meter
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Meters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMeters}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Meters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meters.filter(m => m.units > 0).length}
            </div>
          </CardContent>
        </Card>
        {/* <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unassigned Meters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {0} 
            </div>
          </CardContent>
        </Card> */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Units/Meter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meters.length > 0 
                ? Math.round(meters.reduce((acc, m) => acc + m.units, 0) / meters.length)
                : 0
              }
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search meters by number, IP, or user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Assigned User</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meters.map((meter) => (
                  <TableRow key={meter.meter_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <Zap className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium font-mono">
                            {meter.meter_no}
                          </span>
                          <span className="text-sm text-muted-foreground font-mono">
                            IP: {meter.static_ip}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={meter.units > 0 ? "success" : "secondary"}>
                        {meter.units > 0 ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{meter.units}</span>
                        <span className="text-sm text-muted-foreground">units</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {meter.user ? (
                        <div className="flex flex-col">
                          <span className="font-medium">{meter.user.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {meter.user.email}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={meter.user.account_active ? "outline" : "secondary"}>
                              {meter.user.account_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <Badge variant="outline">Unassigned</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{new Date(meter.created_at).toLocaleDateString()}</span>
                        <span className="text-xs text-muted-foreground">
                          Updated: {new Date(meter.last_updated).toLocaleDateString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/admin/meters/${meter.meter_id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => refreshMeterData(meter.meter_id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {meters.length === 0 && !loading && (
            <div className="text-center py-8">
              <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No meters found</p>
              <Button className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Add New Meter
              </Button>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetersManagementSkeleton() {
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
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card>
        <CardHeader>
          <Skeleton className="h-10 w-full" />
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