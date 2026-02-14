'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Shield,
  Bell,
  Key,
  Mail,
  Phone,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2,
  LogOut,
  Clock,
  Activity
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { get } from '@/lib/fetch';

interface AdminProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  gender: string;
  role: string;
  account_active: boolean;
  is_superuser: boolean;
  email_verified: boolean;
  created_at: string;
  last_login: string;
}

interface NotificationSettings {
  email_notifications: boolean;
  sms_notifications: boolean;
  loan_approvals: boolean;
  user_registrations: boolean;
  system_alerts: boolean;
  weekly_reports: boolean;
  report_schedule: string;
}

interface Session {
  id: number;
  ip_address: string;
  user_agent: string;
  login_time: string;
  expires_at: string;
  is_current: boolean;
}

interface Activity {
  id: number;
  action: string;
  details: any;
  created_at: string;
}

export default function AdminAccountPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState({
    profile: true,
    sessions: false,
    activities: false,
    saving: false
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [editedProfile, setEditedProfile] = useState<Partial<AdminProfile>>({});
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email_notifications: true,
    sms_notifications: false,
    loan_approvals: true,
    user_registrations: true,
    system_alerts: true,
    weekly_reports: false,
    report_schedule: 'weekly'
  });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [terminateDialog, setTerminateDialog] = useState({
    open: false,
    sessionId: 0,
    allSessions: false
  });

  // Fetch admin data
  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(prev => ({ ...prev, profile: true }));
    try {
      const response = await get<any>('admin/account/');

      if (response.error) throw new Error('Failed to fetch admin data');

      // const data = await response.json();

      if (response.data && response.data.profile) {
        setProfile(response.data.user);
        setEditedProfile(response.data.user);
        setNotificationSettings(response.data.notification_settings);
        setSessions(response.data.sessions || []);
        setActivities(response.data.recent_activities || []);
      }
      else if (response.data) {
        setProfile(response.data.user);
        setEditedProfile(response.data.user);
        setNotificationSettings(response.data.notification_settings);
        setSessions(response.data.sessions || []);
        setActivities(response.data.recent_activities || []);
      } else {
        console.error('No data');
      }

      // if (data.success) {
      //   setProfile(data.user);
      //   setEditedProfile(data.user);
      //   setNotificationSettings(data.notification_settings);
      //   setSessions(data.sessions || []);
      //   setActivities(data.recent_activities || []);
      // }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load admin data',
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, profile: false }));
    }
  };

  const handleProfileSave = async () => {
    setLoading(prev => ({ ...prev, saving: true }));
    try {
      const response = await fetch('/api/admin/account/', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify(editedProfile)
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to update profile');

      toast({
        title: 'Success',
        description: data.message,
      });

      // Refresh data
      fetchAdminData();

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, saving: false }));
    }
  };

  const handlePasswordChange = async () => {
    if (securityData.newPassword !== securityData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'New passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (securityData.newPassword.length < 8) {
      toast({
        title: 'Error',
        description: 'Password must be at least 8 characters long',
        variant: 'destructive',
      });
      return;
    }

    setLoading(prev => ({ ...prev, saving: true }));
    try {
      const response = await fetch('/api/admin/account/password-change/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify(securityData)
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to change password');

      toast({
        title: 'Success',
        description: data.message,
      });

      // Clear password fields
      setSecurityData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, saving: false }));
    }
  };

  const handleNotificationSave = async () => {
    setLoading(prev => ({ ...prev, saving: true }));
    try {
      const response = await fetch('/api/admin/account/notifications/', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify(notificationSettings)
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to update notifications');

      toast({
        title: 'Success',
        description: data.message,
      });

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, saving: false }));
    }
  };

  const handleTerminateSession = async (sessionId: number) => {
    try {
      const response = await fetch('/api/admin/account/sessions/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({ session_id: sessionId })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to terminate session');

      toast({
        title: 'Success',
        description: data.message,
      });

      // Refresh sessions
      fetchSessions();

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleTerminateAllSessions = async () => {
    try {
      const response = await fetch('/api/admin/account/sessions/', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to terminate sessions');

      toast({
        title: 'Success',
        description: data.message,
      });

      // Refresh sessions
      fetchSessions();

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const fetchSessions = async () => {
    setLoading(prev => ({ ...prev, sessions: true }));
    try {
      const response = await fetch('/api/admin/account/sessions/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSessions(data.sessions);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load sessions',
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, sessions: false }));
    }
  };

  const fetchActivities = async () => {
    setLoading(prev => ({ ...prev, activities: true }));
    try {
      const response = await fetch('/api/admin/account/activities/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setActivities(data.activities);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load activities',
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, activities: false }));
    }
  };

  if (loading.profile && !profile) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Account</h1>
          <p className="text-muted-foreground">
            Manage your admin account settings and preferences
          </p>
        </div>
        {profile && (
          <Badge variant="outline" className="gap-2">
            <Shield className="h-3 w-3" />
            {profile.role}
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full md:w-auto grid-cols-4">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Key className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <Clock className="h-4 w-4" />
            Sessions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your personal details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {profile ? (
                <>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={editedProfile.first_name || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, first_name: e.target.value })}
                        disabled={loading.saving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={editedProfile.last_name || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, last_name: e.target.value })}
                        disabled={loading.saving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={editedProfile.email || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, email: e.target.value })}
                        disabled={loading.saving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        value={editedProfile.phone_number || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, phone_number: e.target.value })}
                        disabled={loading.saving}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Account Role</Label>
                      <div className="flex items-center gap-2 p-2 border rounded-md">
                        <Shield className="h-4 w-4 text-primary" />
                        <span>{profile.role}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Last Login</Label>
                      <div className="p-2 border rounded-md">
                        {profile.last_login ? new Date(profile.last_login).toLocaleString() : 'Never'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Account Created</Label>
                      <div className="p-2 border rounded-md">
                        {new Date(profile.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Account Status</Label>
                      <div className="flex items-center gap-2 p-2 border rounded-md">
                        {profile.account_active ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-green-600 font-medium">Active</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="text-red-600 font-medium">Inactive</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleProfileSave} disabled={loading.saving}>
                      {loading.saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="mt-4 text-muted-foreground">Failed to load profile data</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>
                Your recent account activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-primary" />
                          <span className="font-medium">{activity.action}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(activity.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {Object.keys(activity.details || {}).length > 0 ? 'With details' : 'No details'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No recent activities</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={securityData.currentPassword}
                      onChange={(e) => setSecurityData({ ...securityData, currentPassword: e.target.value })}
                      disabled={loading.saving}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={securityData.newPassword}
                      onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                      disabled={loading.saving}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Password must be at least 8 characters long
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={securityData.confirmPassword}
                      onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                      disabled={loading.saving}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <h3 className="font-semibold">Security Tips</h3>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    Use a strong password with letters, numbers, and symbols
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    Never share your password with anyone
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    Change your password regularly
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    Always log out when using public computers
                  </li>
                </ul>
              </div>

              <div className="flex justify-end">
                <Button onClick={handlePasswordChange} disabled={loading.saving}>
                  {loading.saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Changing...
                    </>
                  ) : (
                    <>
                      <Key className="mr-2 h-4 w-4" />
                      Change Password
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="emailNotifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="emailNotifications"
                    checked={notificationSettings.email_notifications}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      email_notifications: e.target.checked
                    })}
                    className="h-6 w-6 rounded border-gray-300"
                    disabled={loading.saving}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="smsNotifications">SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via SMS
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="smsNotifications"
                    checked={notificationSettings.sms_notifications}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      sms_notifications: e.target.checked
                    })}
                    className="h-6 w-6 rounded border-gray-300"
                    disabled={loading.saving}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Notification Types</h4>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="loanApprovals">Loan Approvals</Label>
                      <p className="text-sm text-muted-foreground">
                        Notify when new loans need approval
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      id="loanApprovals"
                      checked={notificationSettings.loan_approvals}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        loan_approvals: e.target.checked
                      })}
                      className="h-6 w-6 rounded border-gray-300"
                      disabled={loading.saving}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="userRegistrations">New User Registrations</Label>
                      <p className="text-sm text-muted-foreground">
                        Notify when new users register
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      id="userRegistrations"
                      checked={notificationSettings.user_registrations}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        user_registrations: e.target.checked
                      })}
                      className="h-6 w-6 rounded border-gray-300"
                      disabled={loading.saving}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="systemAlerts">System Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Important system notifications and alerts
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      id="systemAlerts"
                      checked={notificationSettings.system_alerts}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        system_alerts: e.target.checked
                      })}
                      className="h-6 w-6 rounded border-gray-300"
                      disabled={loading.saving}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="weeklyReports">Weekly Reports</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive weekly summary reports
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      id="weeklyReports"
                      checked={notificationSettings.weekly_reports}
                      onChange={(e) => setNotificationSettings({
                        ...notificationSettings,
                        weekly_reports: e.target.checked
                      })}
                      className="h-6 w-6 rounded border-gray-300"
                      disabled={loading.saving}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Notification Schedule</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Email notifications are sent immediately. SMS notifications may have delays.
                  Weekly reports are sent every Monday at 9:00 AM.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleNotificationSave} disabled={loading.saving}>
                  {loading.saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Preferences
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Session Management</CardTitle>
                  <CardDescription>
                    Manage your active sessions and login history
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTerminateDialog({ open: true, sessionId: 0, allSessions: true })}
                  disabled={sessions.filter(s => !s.is_current).length === 0}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Terminate All Other Sessions
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading.sessions ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : sessions.length > 0 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Active Sessions ({sessions.filter(s => s.is_current).length})</h4>
                    {sessions
                      .filter(session => session.is_current)
                      .map((session) => (
                        <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-1">
                            <p className="font-medium">Current Session</p>
                            <p className="text-sm text-muted-foreground">
                              IP: {session.ip_address} • {session.user_agent}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Started: {new Date(session.login_time).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant="success">Current</Badge>
                        </div>
                      ))}
                  </div>

                  {sessions.filter(s => !s.is_current).length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Other Sessions</h4>
                      <div className="space-y-2">
                        {sessions
                          .filter(session => !session.is_current)
                          .map((session) => (
                            <div key={session.id} className="flex items-center justify-between p-3 border rounded">
                              <div className="space-y-1">
                                <p className="text-sm font-medium">IP: {session.ip_address}</p>
                                <p className="text-xs text-muted-foreground truncate max-w-md">
                                  {session.user_agent}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(session.login_time).toLocaleString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={new Date(session.expires_at) > new Date() ? "default" : "secondary"}>
                                  {new Date(session.expires_at) > new Date() ? 'Active' : 'Expired'}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setTerminateDialog({ open: true, sessionId: session.id, allSessions: false })}
                                >
                                  <LogOut className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="mt-4 text-muted-foreground">No sessions found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Terminate Session Dialog */}
      <AlertDialog open={terminateDialog.open} onOpenChange={(open) => setTerminateDialog({ ...terminateDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {terminateDialog.allSessions ? 'Terminate All Other Sessions' : 'Terminate Session'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {terminateDialog.allSessions
                ? 'This will log you out from all other devices. You will remain logged in on this device.'
                : 'Are you sure you want to terminate this session? The user will be logged out from that device.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (terminateDialog.allSessions) {
                  handleTerminateAllSessions();
                } else {
                  handleTerminateSession(terminateDialog.sessionId);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Terminate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}