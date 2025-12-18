'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { authFetch } from '@/lib/auth';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  Home,
  CreditCard,
  Zap,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface UserDetail {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  gender: string;
  email_verified: boolean;
  account_active: boolean;
  created_at: string;
  last_login: string | null;
  profile_data: {
    monthly_expenditure: number;
    purchase_frequency: string;
    payment_consistency: string;
    disconnection_history: string;
    meter_sharing: boolean;
    monthly_income: number;
    income_stability: string;
    consumption_level: string;
    profile_complete: boolean;
  };
  meter: {
    id: number;
    meter_no: string;
    static_ip: string;
    units: number;
    created_at: string;
    updated_at: string;
  } | null;
  account_details: {
    account_number: string;
    address: string;
    energy_preference: string;
    payment_method: string;
    created_at: string;
  } | null;
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const API_BASE = 'http://localhost:8000/api/v1';

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_BASE}/admin/users/${params.id}/`);

      if (res.status === 403 || res.status === 401) {
        router.push('/dashboard');
        return;
      }

      if (!res.ok) throw new Error('Failed to fetch user details');

      const data = await res.json();
      setUser(data.user);
    } catch (error) {
      console.error('Error fetching user details:', error);
      toast({
        title: 'Error',
        description: 'Failed to load user details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async () => {
    if (!user) return;

    try {
      const res = await authFetch(`${API_BASE}/admin/toggle-user-status/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: user.id }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser({ ...user, account_active: data.user.account_active });
        
        toast({
          title: 'Success',
          description: `User ${data.user.account_active ? 'activated' : 'deactivated'} successfully`,
        });
      } else {
        throw new Error('Failed to update user status');
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user status',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchUserDetails();
  }, [params.id]);

  if (loading) {
    return <UserDetailSkeleton />;
  }

  if (!user) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">User not found</h3>
            <p className="text-muted-foreground mb-4">
              The user you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Button onClick={() => router.push('/admin/users')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Users
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/admin/users')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {user.first_name} {user.last_name}
            </h1>
            <p className="text-muted-foreground">User ID: {user.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={user.account_active ? "destructive" : "default"}
            onClick={toggleUserStatus}
          >
            {user.account_active ? 'Deactivate User' : 'Activate User'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="account">Account Details</TabsTrigger>
              <TabsTrigger value="meter">Meter Information</TabsTrigger>
            </TabsList>
            
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                      <p className="text-base">{user.first_name} {user.last_name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Gender</p>
                      <p className="text-base capitalize">{user.gender || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Email</p>
                      <div className="flex items-center gap-2">
                        <p className="text-base">{user.email}</p>
                        {user.email_verified ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Unverified
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Phone</p>
                      <p className="text-base">{user.phone_number}</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <CardTitle className="text-lg mb-4">Profile Assessment</CardTitle>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Monthly Expenditure</p>
                        <p className="text-base">USh {user.profile_data.monthly_expenditure?.toLocaleString() || '0'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Monthly Income</p>
                        <p className="text-base">USh {user.profile_data.monthly_income?.toLocaleString() || '0'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Purchase Frequency</p>
                        <p className="text-base capitalize">{user.profile_data.purchase_frequency || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Payment Consistency</p>
                        <p className="text-base capitalize">{user.profile_data.payment_consistency || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Consumption Level</p>
                        <p className="text-base capitalize">{user.profile_data.consumption_level || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Profile Complete</p>
                        <Badge variant={user.profile_data.profile_complete ? "success" : "secondary"}>
                          {user.profile_data.profile_complete ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="account">
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                </CardHeader>
                <CardContent>
                  {user.account_details ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Account Status</p>
                          <div className="flex items-center gap-2">
                            <Badge variant={user.account_active ? "success" : "destructive"}>
                              {user.account_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Account Number</p>
                          <p className="text-base font-mono">{user.account_details.account_number}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Energy Preference</p>
                          <p className="text-base capitalize">{user.account_details.energy_preference}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Payment Method</p>
                          <p className="text-base capitalize">{user.account_details.payment_method}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Address</p>
                        <p className="text-base">{user.account_details.address}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Account Created</p>
                        <p className="text-base">{new Date(user.account_details.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No account details found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="meter">
              <Card>
                <CardHeader>
                  <CardTitle>Meter Information</CardTitle>
                </CardHeader>
                <CardContent>
                  {user.meter ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Meter Number</p>
                          <p className="text-base font-mono">{user.meter.meter_no}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Static IP</p>
                          <p className="text-base font-mono">{user.meter.static_ip}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Current Units</p>
                          <p className="text-base">{user.meter.units}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                          <p className="text-base">{new Date(user.meter.updated_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Meter Created</p>
                          <p className="text-base">{new Date(user.meter.created_at).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Meter Age</p>
                          <p className="text-base">
                            {Math.floor((new Date().getTime() - new Date(user.meter.created_at).getTime()) / (1000 * 60 * 60 * 24))} days
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No meter assigned to this user</p>
                      <Button className="mt-4">Assign Meter</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Account Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Member Since</p>
                <p className="text-base">{new Date(user.created_at).toLocaleDateString()}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Last Login</p>
                <p className="text-base">
                  {user.last_login 
                    ? new Date(user.last_login).toLocaleString()
                    : 'Never'
                  }
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Verification Status</p>
                <Badge variant={user.email_verified ? "success" : "destructive"}>
                  {user.email_verified ? 'Email Verified' : 'Email Unverified'}
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Account Status</p>
                <Badge variant={user.account_active ? "success" : "destructive"}>
                  {user.account_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <CreditCard className="mr-2 h-4 w-4" />
                View Transactions
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Zap className="mr-2 h-4 w-4" />
                Meter History
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <AlertCircle className="mr-2 h-4 w-4" />
                Report Issue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function UserDetailSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Skeleton className="h-10 w-full" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-32" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-32" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}