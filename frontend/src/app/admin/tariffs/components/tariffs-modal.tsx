// Step 5: Implement frontend for tariffs-modal.tsx (as a modal component)
// This can be imported and used in a tariffs page or the main loans page.
// For simplicity, I'll provide a separate page that uses this modal, but you can integrate it into page.tsx if needed.
// Assume creating a tariffs.tsx page similar to loan-tiers.tsx

// First, the modal component (tariffs-modal.tsx)

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { authFetch } from '@/lib/auth';

interface TariffBlock {
  id?: number;
  block_name: string;
  min_units: number;
  max_units?: number;
  rate_per_unit: number;
  block_order: number;
}

interface Tariff {
  id: number;
  tariff_code: string;
  tariff_name: string;
  tariff_type: string;
  voltage_level: string;
  voltage_value: string;
  service_charge: number;
  is_active: boolean;
  effective_date: string;
  blocks: TariffBlock[];
}

interface TariffsModalProps {
  tariff: Tariff | null;
  onSave: () => void;
}

export default function TariffsModal({ tariff, onSave }: TariffsModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<Tariff>(tariff || {
    id: 0,
    tariff_code: '',
    tariff_name: '',
    tariff_type: 'DOMESTIC',
    voltage_level: '',
    voltage_value: '',
    service_charge: 0,
    is_active: true,
    effective_date: new Date().toISOString(),
    blocks: [],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBlockChange = (index: number, name: keyof TariffBlock, value: string) => {
    const newBlocks = [...form.blocks];
    newBlocks[index] = { ...newBlocks[index], [name]: parseFloat(value) || value };
    setForm((prev) => ({ ...prev, blocks: newBlocks }));
  };

  const addBlock = () => {
    setForm((prev) => ({
      ...prev,
      blocks: [
        ...prev.blocks,
        { block_name: '', min_units: 0, max_units: undefined, rate_per_unit: 0, block_order: prev.blocks.length + 1 },
      ],
    }));
  };

  const removeBlock = (index: number) => {
    const newBlocks = form.blocks.filter((_, i) => i !== index);
    setForm((prev) => ({ ...prev, blocks: newBlocks }));
  };

  const handleSubmit = async () => {
    try {
      const url = form.id ? `/admin/tariffs/${form.id}/` : '/admin/tariffs/';
      const method = form.id ? 'PUT' : 'POST';
      const res = await authFetch(url, {
        method,
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast({ title: 'Success', description: 'Tariff saved' });
      onSave();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save tariff', variant: 'destructive' });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>{form.id ? 'Edit' : 'Create Tariff'}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Edit Tariff' : 'Create New Tariff'}</DialogTitle>
          <DialogDescription>Manage tariff details and blocks.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tariff_code">Code</Label>
              <Input id="tariff_code" name="tariff_code" value={form.tariff_code} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="tariff_name">Name</Label>
              <Input id="tariff_name" name="tariff_name" value={form.tariff_name} onChange={handleChange} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tariff_type">Type</Label>
              <Select
                value={form.tariff_type}
                onValueChange={(value) => setForm((prev) => ({ ...prev, tariff_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DOMESTIC">Domestic</SelectItem>
                  <SelectItem value="COMMERCIAL">Commercial</SelectItem>
                  <SelectItem value="INDUSTRIAL">Industrial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="service_charge">Service Charge</Label>
              <Input
                id="service_charge"
                name="service_charge"
                type="number"
                value={form.service_charge}
                onChange={handleChange}
              />
            </div>
          </div>
          {/* Add more fields as needed */}
          <div>
            <Label>Blocks</Label>
            {form.blocks.map((block, index) => (
              <div key={index} className="grid grid-cols-5 gap-2 mt-2">
                <Input
                  placeholder="Name"
                  value={block.block_name}
                  onChange={(e) => handleBlockChange(index, 'block_name', e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Min Units"
                  value={block.min_units}
                  onChange={(e) => handleBlockChange(index, 'min_units', e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Max Units"
                  value={block.max_units || ''}
                  onChange={(e) => handleBlockChange(index, 'max_units', e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Rate"
                  value={block.rate_per_unit}
                  onChange={(e) => handleBlockChange(index, 'rate_per_unit', e.target.value)}
                />
                <Button variant="destructive" onClick={() => removeBlock(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={addBlock} className="mt-2">
              <Plus className="h-4 w-4 mr-2" /> Add Block
            </Button>
          </div>
        </div>
        <Button onClick={handleSubmit}>Save Changes</Button>
      </DialogContent>
    </Dialog>
  );
}