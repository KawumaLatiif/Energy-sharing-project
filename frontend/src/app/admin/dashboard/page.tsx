'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Zap,
  DollarSign,
  AlertCircle,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { get } from "@/lib/fetch";

interface AdminStats {
  total_users: number;
  total_admins: number;
  total_meters: number;
  active_meters: number;
  verified_users: number;
  users_with_meters: number;
  new_users_today: number;
  new_users_week: number;
  total_loans: number;
  active_loans: number;
  pending_loans: number;
  outstanding_balance: number;
  recent_registrations: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats>({
    total_users: 0,
    total_admins: 0,
    total_meters: 0,
    active_meters: 0,
    verified_users: 0,
    users_with_meters: 0,
    new_users_today: 0,
    new_users_week: 0,
    total_loans: 0,
    active_loans: 0,
    pending_loans: 0,
    outstanding_balance: 0,
    recent_registrations: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        console.log('Fetching admin dashboard data...');
        const res = await get<any>("admin/dashboard/");
        
        console.log('Admin Dashboard Response:', res);
        
        if (res.status === 403 || res.status === 401) {
          console.log('Unauthorized access to admin dashboard');
          router.push('/dashboard');
          return;
        }
        
        if (res.error) {
          console.error('Failed to load admin dashboard:', res.error);
          return;
        }

        // Check if data is nested under 'stats' or flat
        if (res.data && res.data.stats) {
          console.log('Data is nested under stats:', res.data.stats);
          // Map nested data to flat structure
          setStats({
            total_users: res.data.stats.total_users || 0,
            total_admins: res.data.stats.total_admins || 0,
            total_meters: res.data.stats.total_meters || 0,
            active_meters: res.data.stats.active_meters || 0,
            verified_users: res.data.stats.verified_users || 0,
            users_with_meters: res.data.stats.users_with_meters || 0,
            new_users_today: res.data.stats.new_users_today || 0,
            new_users_week: res.data.stats.new_users_week || 0,
            total_loans: res.data.total_loans || 0,
            active_loans: res.data.active_loans || 0,
            pending_loans: res.data.pending_loans || 0,
            outstanding_balance: res.data.outstanding_balance || 0,
            recent_registrations: res.data.recent_registrations || 0,
          });
        } else if (res.data) {
          console.log('Data is flat:', res.data);
          // Data is already flat
          setStats({
            total_users: res.data.total_users || 0,
            total_admins: res.data.total_admins || 0,
            total_meters: res.data.total_meters || 0,
            active_meters: res.data.active_meters || 0,
            verified_users: res.data.verified_users || 0,
            users_with_meters: res.data.users_with_meters || 0,
            new_users_today: res.data.new_users_today || 0,
            new_users_week: res.data.new_users_week || 0,
            total_loans: res.data.total_loans || 0,
            active_loans: res.data.active_loans || 0,
            pending_loans: res.data.pending_loans || 0,
            outstanding_balance: res.data.outstanding_balance || 0,
            recent_registrations: res.data.recent_registrations || res.data.new_users_week || 0,
          });
        } else {
          console.error('No data in response');
        }
      } catch (err) {
        console.error('Admin dashboard error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      <div className="grid gap-6 mb-8 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total_users || 0}</div>
            <p className="text-xs text-muted-foreground">All registered users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registered Meters</CardTitle>
            <Zap className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total_meters || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <DollarSign className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.active_loans || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Loans</CardTitle>
            <AlertCircle className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total_admins || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 mb-8 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Loans</CardTitle>
            <FileText className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_loans || 0}</div>
          </CardContent>
        </Card>

        {/* <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <TrendingUp className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              USh {(stats.outstanding_balance || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card> */}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Registrations</CardTitle>
            <Users className="h-5 w-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.recent_registrations || 0}
            </div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <Button onClick={() => router.push('/admin/users')} size="lg">
            <Users className="mr-2 h-4 w-4" /> Manage Users
          </Button>
          <Button onClick={() => router.push('/admin/meters')} variant="outline" size="lg">
            <Zap className="mr-2 h-4 w-4" /> Manage Meters
          </Button>
          <Button onClick={() => router.push('/admin/loans')} variant="outline" size="lg">
            <DollarSign className="mr-2 h-4 w-4" /> Manage Loans
          </Button>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-4 w-40 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}