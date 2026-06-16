'use client';

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Download,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Zap,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/fetch';

interface Meter {
  meter_id: number;
  meter_no: string;
  label: string;
  status: string;
  static_ip: string;
  units: number;
  user: {
    id: number;
    email: string;
    name: string;
    phone: string;
  };
  created_at: string;
  last_updated: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-700",
  SUSPENDED: "bg-red-100 text-red-800",
};

export default function MetersManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMeters, setTotalMeters] = useState(0);

  // Dialogs
  const [registerDialog, setRegisterDialog] = useState(false);
  const [deactivateDialog, setDeactivateDialog] = useState<Meter | null>(null);
  const [transferDialog, setTransferDialog] = useState<Meter | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [registerForm, setRegisterForm] = useState({ meter_no: '', user_id: '', label: 'Home' });
  const [deactivateReason, setDeactivateReason] = useState('');
  const [deactivateNote, setDeactivateNote] = useState('');
  const [transferUserId, setTransferUserId] = useState('');
  const [transferNote, setTransferNote] = useState('');

  const fetchMeters = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: '20' });
      if (search) params.set('search', search);
      const res = await get<any>(`admin/meters/?${params}`);
      if (res.data?.meters) {
        setMeters(res.data.meters);
        setTotalPages(res.data.pagination?.pages ?? 1);
        setTotalMeters(res.data.pagination?.total ?? 0);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load meters', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentPage, search]);

  useEffect(() => { fetchMeters(); }, [fetchMeters]);

  async function handleRegister() {
    if (!registerForm.meter_no || !registerForm.user_id) return;
    setSubmitting(true);
    try {
      const res = await post<any>('admin/meters/', registerForm);
      if (res.data?.success) {
        toast({ title: 'Success', description: 'Meter registered successfully' });
        setRegisterDialog(false);
        setRegisterForm({ meter_no: '', user_id: '', label: 'Home' });
        fetchMeters();
      } else {
        toast({ title: 'Error', description: res.data?.error || 'Registration failed', variant: 'destructive' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivateDialog || !deactivateReason) return;
    setSubmitting(true);
    try {
      const res = await post<any>(`admin/meters/${deactivateDialog.meter_id}/deactivate/`, {
        reason: deactivateReason,
        note: deactivateNote,
      });
      if (res.data?.success) {
        toast({ title: 'Success', description: 'Meter deactivated' });
        setDeactivateDialog(null);
        setDeactivateReason('');
        setDeactivateNote('');
        fetchMeters();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTransfer() {
    if (!transferDialog || !transferUserId) return;
    setSubmitting(true);
    try {
      const res = await post<any>(`admin/meters/${transferDialog.meter_id}/transfer/`, {
        new_user_id: transferUserId,
        note: transferNote,
      });
      if (res.data?.success) {
        toast({ title: 'Success', description: 'Ownership transferred' });
        setTransferDialog(null);
        setTransferUserId('');
        setTransferNote('');
        fetchMeters();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function exportCSV() {
    const rows = [
      ['Meter No', 'Label', 'Status', 'Units', 'User', 'Email', 'Registered'],
      ...meters.map(m => [
        m.meter_no, m.label, m.status, String(m.units),
        m.user.name, m.user.email,
        new Date(m.created_at).toLocaleDateString()
      ])
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meters-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meter Management</h1>
          <p className="text-sm text-muted-foreground">{totalMeters} meters registered</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button size="sm" onClick={() => setRegisterDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Register Meter
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by meter number, user email..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading && meters.length === 0 ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Meter</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {meters.map((m) => (
                      <TableRow key={m.meter_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary shrink-0" />
                            <div>
                              <p className="font-mono font-medium text-sm">{m.meter_no}</p>
                              <p className="text-xs text-muted-foreground">{m.label}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[m.status] ?? ''}`}>
                            {m.status}
                          </span>
                        </TableCell>
                        <TableCell className="tabular-nums">{m.units.toFixed(2)} kWh</TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{m.user.name}</p>
                          <p className="text-xs text-muted-foreground">{m.user.email}</p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(m.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 text-xs"
                              onClick={() => router.push(`/admin/meters/${m.meter_id}`)}>
                              <Eye className="h-3 w-3 mr-1" /> View
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs"
                              onClick={() => setTransferDialog(m)}>
                              Transfer
                            </Button>
                            {m.status === 'ACTIVE' && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600"
                                onClick={() => setDeactivateDialog(m)}>
                                Deactivate
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Register meter dialog */}
      <Dialog open={registerDialog} onOpenChange={setRegisterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register New Meter</DialogTitle>
            <DialogDescription>Operator or Admin can register meters. Provide the physical meter number and the user to assign it to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Meter Number *</label>
              <Input
                placeholder="e.g. 12345678901234567890"
                value={registerForm.meter_no}
                onChange={(e) => setRegisterForm({ ...registerForm, meter_no: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">User ID *</label>
              <Input
                type="number"
                placeholder="User's system ID"
                value={registerForm.user_id}
                onChange={(e) => setRegisterForm({ ...registerForm, user_id: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Label</label>
              <Input
                placeholder="e.g. Home, Shop"
                value={registerForm.label}
                onChange={(e) => setRegisterForm({ ...registerForm, label: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterDialog(false)}>Cancel</Button>
            <Button onClick={handleRegister} disabled={!registerForm.meter_no || !registerForm.user_id || submitting}>
              {submitting ? "Registering…" : "Register Meter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate dialog */}
      <Dialog open={!!deactivateDialog} onOpenChange={() => setDeactivateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Meter</DialogTitle>
            <DialogDescription>
              Deactivate meter <strong className="font-mono">{deactivateDialog?.meter_no}</strong>. This is reversible by Admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Reason *</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
              >
                <option value="">Select reason</option>
                <option value="Meter Stolen">Meter Stolen</option>
                <option value="Meter Damaged">Meter Damaged</option>
                <option value="Customer Moved Out">Customer Moved Out</option>
                <option value="Fraud Investigation">Fraud Investigation</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes</label>
              <Input value={deactivateNote} onChange={(e) => setDeactivateNote(e.target.value)} placeholder="Optional details..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={!deactivateReason || submitting}>
              {submitting ? "Processing…" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer dialog */}
      <Dialog open={!!transferDialog} onOpenChange={() => setTransferDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Meter Ownership</DialogTitle>
            <DialogDescription>
              Transfer <strong className="font-mono">{transferDialog?.meter_no}</strong> from <strong>{transferDialog?.user.name}</strong> to a new owner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">New Owner's User ID *</label>
              <Input
                type="number"
                placeholder="User's system ID"
                value={transferUserId}
                onChange={(e) => setTransferUserId(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes</label>
              <Input value={transferNote} onChange={(e) => setTransferNote(e.target.value)} placeholder="Reason for transfer..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialog(null)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={!transferUserId || submitting}>
              {submitting ? "Transferring…" : "Transfer Ownership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
