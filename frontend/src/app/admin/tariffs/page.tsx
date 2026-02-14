'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
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
import { Pencil, Trash2, Plus, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { get, put, post, del } from '@/lib/fetch';
import Link from 'next/link';

// ──────────────────────────────────────────────
// Tariff & Block types (minimal version)
interface TariffBlock {
  id?: number;
  block_name: string;
  min_units: number;
  max_units?: number | null;
  rate_per_unit: number;
  block_order: number;
}

interface Tariff {
  id: number;
  tariff_code: string;
  tariff_name: string;
  tariff_type: 'DOMESTIC' | 'COMMERCIAL' | 'INDUSTRIAL';
  voltage_level: string;
  voltage_value: string;
  service_charge: number;
  is_active: boolean;
  effective_date: string;
  blocks: TariffBlock[];
}

// ──────────────────────────────────────────────
// Simple Modal Component (you can extract to separate file)
function TariffModal({
  tariff,
  onClose,
  onSaved,
}: {
  tariff: Tariff | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!tariff?.id;

  const [form, setForm] = useState<Tariff>(
    tariff || {
      id: 0,
      tariff_code: '',
      tariff_name: '',
      tariff_type: 'DOMESTIC',
      voltage_level: '',
      voltage_value: '',
      service_charge: 0,
      is_active: true,
      effective_date: new Date().toISOString().split('T')[0],
      blocks: [],
    }
  );

  const addBlock = () =>
    setForm(prev => ({
      ...prev,
      blocks: [
        ...prev.blocks,
        {
          block_name: `Block ${prev.blocks.length + 1}`,
          min_units: prev.blocks.length === 0 ? 0 : (prev.blocks[prev.blocks.length - 1].max_units ?? 0) + 1,
          max_units: null,
          rate_per_unit: 0,
          block_order: prev.blocks.length + 1,
        },
      ],
    }));

  const updateBlock = (index: number, field: keyof TariffBlock, value: any) => {
    setForm(prev => {
      const newBlocks = [...prev.blocks];
      newBlocks[index] = { ...newBlocks[index], [field]: value };
      return { ...prev, blocks: newBlocks };
    });
  };

  const removeBlock = (index: number) =>
    setForm(prev => ({
      ...prev,
      blocks: prev.blocks.filter((_, i) => i !== index),
    }));

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        effective_date: form.effective_date || new Date().toISOString(),
      };

      const endpoint = isEdit ? `admin/tariffs/${form.id}/` : 'admin/tariffs/';
      const method = isEdit ? put : post;

      const response = await method(endpoint, payload);

      if (response.error) {
        throw new Error(response.error?.message || 'Save failed');
      }

      toast({ title: 'Success', description: `Tariff ${isEdit ? 'updated' : 'created'}` });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Could not save tariff',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {isEdit ? 'Edit Tariff' : 'Create New Tariff'}
        </h2>

        {/* Basic fields */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm mb-1">Code</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.tariff_code}
              onChange={e => setForm({ ...form, tariff_code: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Name</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.tariff_name}
              onChange={e => setForm({ ...form, tariff_name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Tariff Type</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={form.tariff_type}
              onChange={e => setForm({ ...form, tariff_type: e.target.value as Tariff['tariff_type'] })}
            >
              <option value="DOMESTIC">Domestic</option>
              <option value="COMMERCIAL">Commercial</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Voltage Level</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.voltage_level}
              onChange={e => setForm({ ...form, voltage_level: e.target.value })}
            />  
          </div>
          <div>
            <label className="block text-sm mb-1">Voltage Value</label>
            <input
              className="border rounded px-3 py-2 w-full"   
              value={form.voltage_value}
              onChange={e => setForm({ ...form, voltage_value: e.target.value })}
            />  
          </div>
          <div>
            <label className="block text-sm mb-1">Service Charge</label>
            <input
              type="number" 
              className="border rounded px-3 py-2 w-full"
              value={form.service_charge}
              onChange={e => setForm({ ...form, service_charge: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Effective Date</label>
            <input
              type="date"
              className="border rounded px-3 py-2 w-full"
              value={form.effective_date}
              onChange={e => setForm({ ...form, effective_date: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Active</label>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm({ ...form, is_active: e.target.checked })}
            />
          </div>
        </div>

        {/* Blocks */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Pricing Blocks</h3>
            <Button variant="outline" size="sm" onClick={addBlock}>
              <Plus className="h-4 w-4 mr-1" /> Add Block
            </Button>
          </div>

          {form.blocks.map((block, idx) => (
            <div key={idx} className="border rounded p-3 mb-3 grid grid-cols-5 gap-3">
              <input
                placeholder="Block name"
                value={block.block_name}
                onChange={e => updateBlock(idx, 'block_name', e.target.value)}
                className="border rounded px-2 py-1"
              />
              <input
                type="number"
                placeholder="Min units"
                value={block.min_units}
                onChange={e => updateBlock(idx, 'min_units', Number(e.target.value))}
                className="border rounded px-2 py-1 w-24"
              />
              <input
                type="number"
                placeholder="Max units (empty = ∞)"
                value={block.max_units ?? ''}
                onChange={e => updateBlock(idx, 'max_units', e.target.value ? Number(e.target.value) : null)}
                className="border rounded px-2 py-1 w-28"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Rate / unit"
                value={block.rate_per_unit}
                onChange={e => updateBlock(idx, 'rate_per_unit', Number(e.target.value))}
                className="border rounded px-2 py-1"
              />
              <Button variant="destructive" size="sm" onClick={() => removeBlock(idx)}>
                Remove
              </Button>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>
    </div>
  );
}

export default function TariffsManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);

  const loadTariffs = async () => {
    try {
      setLoading(true);
      const res = await get<Tariff[]>('admin/tariffs/');

      if (res.error) {
        if (res.status === 401 || res.status === 403) {
          router.push('/login');
          return;
        }
        throw new Error(res.error?.message || 'Failed');
      }

      setTariffs(res.data || []);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Could not load tariffs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTariffs();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this tariff?')) return;
    try {
      const res = await del(`admin/tariffs/${id}/`);
      if (res.error) throw new Error(res.error?.message || 'Delete failed');
      toast({ title: 'Deleted', description: 'Tariff removed' });
      loadTariffs();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) return <Skeleton className="h-[500px] w-full" />;

  return (
    <div className="container mx-auto py-10">
      {/* Back button */}
    <div className="mb-6">
      <Button 
        variant="ghost" 
        size="sm" 
        asChild
        className="gap-2 text-muted-foreground hover:text-foreground"
      >
        <Link href="/admin/loans">
          <ArrowLeft className="h-4 w-4" />
          Back to Loans Management
        </Link>
      </Button>
    </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tariffs Management</CardTitle>
          </div>
          <Button onClick={() => setEditingTariff({} as Tariff)}>
            <Plus className="h-4 w-4 mr-2" /> New Tariff
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Service Charge</TableHead>
                <TableHead>Blocks</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tariffs.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.tariff_code}</TableCell>
                  <TableCell>{t.tariff_name}</TableCell>
                  <TableCell>{t.tariff_type}</TableCell>
                  <TableCell>{t.service_charge} UGX</TableCell>
                  <TableCell>{t.blocks?.length || 0}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingTariff(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {editingTariff !== null && (
            <TariffModal
              tariff={editingTariff}
              onClose={() => setEditingTariff(null)}
              onSaved={() => {
                loadTariffs();
                setEditingTariff(null);
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}