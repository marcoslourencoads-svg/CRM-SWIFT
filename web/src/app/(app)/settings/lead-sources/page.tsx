'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ColorPicker } from '@/components/ui/color-picker';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import api from '@/lib/api';

const LEAD_SOURCE_TYPES = [
  'ORGANIC',
  'PAID',
  'REFERRAL',
  'DIRECT',
  'OUTBOUND',
  'EVENT',
  'OTHER',
] as const;

type LeadSourceType = (typeof LEAD_SOURCE_TYPES)[number];

interface LeadSource {
  id: string;
  name: string;
  type: LeadSourceType;
  color: string;
}

export default function LeadSourcesPage() {
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<LeadSource | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<LeadSourceType>('ORGANIC');
  const [color, setColor] = useState('#10b981');

  const fetchSources = useCallback(async () => {
    try {
      const res = await api.get('/lead-sources');
      setSources(res.data.data);
    } catch {
      toast.error('Erro ao carregar fontes de origem');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const openCreate = () => {
    setEditingSource(null);
    setName('');
    setType('ORGANIC');
    setColor('#10b981');
    setDialogOpen(true);
  };

  const openEdit = (source: LeadSource) => {
    setEditingSource(source);
    setName(source.name);
    setType(source.type);
    setColor(source.color);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      if (editingSource) {
        await api.patch(`/lead-sources/${editingSource.id}`, {
          name,
          type,
          color,
        });
        toast.success('Fonte de origem atualizada');
      } else {
        await api.post('/lead-sources', { name, type, color });
        toast.success('Fonte de origem criada');
      }
      setDialogOpen(false);
      fetchSources();
    } catch {
      toast.error('Erro ao salvar fonte de origem');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta fonte de origem?')) return;
    try {
      await api.delete(`/lead-sources/${id}`);
      toast.success('Fonte de origem excluída');
      fetchSources();
    } catch {
      toast.error('Erro ao excluir fonte de origem');
    }
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-4">Fontes de Origem</h2>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Fontes de Origem</h2>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Fonte
        </Button>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left font-medium px-4 py-2">Nome</th>
              <th className="text-left font-medium px-4 py-2">Tipo</th>
              <th className="text-left font-medium px-4 py-2">Preview</th>
              <th className="text-right font-medium px-4 py-2 w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr
                key={source.id}
                className="border-b last:border-b-0 hover:bg-muted/20"
              >
                <td className="px-4 py-2">{source.name}</td>
                <td className="px-4 py-2">
                  <Badge variant="outline" className="text-xs">
                    {source.type}
                  </Badge>
                </td>
                <td className="px-4 py-2">
                  <Badge
                    style={{ backgroundColor: source.color, color: '#fff' }}
                    className="border-0"
                  >
                    {source.name}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEdit(source)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDelete(source.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {sources.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  Nenhuma fonte de origem cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSource ? 'Editar Fonte de Origem' : 'Nova Fonte de Origem'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Google Ads"
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as LeadSourceType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cor</Label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave}>
              {editingSource ? 'Salvar' : 'Criar Fonte'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
