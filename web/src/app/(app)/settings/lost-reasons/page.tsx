'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import api from '@/lib/api';

interface LostReason {
  id: string;
  name: string;
  position: number;
  isActive: boolean;
}

export default function LostReasonsPage() {
  const [list, setList] = useState<LostReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LostReason | null>(null);
  const [name, setName] = useState('');

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/lost-reasons');
      setList(res.data.data ?? []);
    } catch {
      toast.error('Erro ao carregar motivos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setEditing(null); setName(''); setDialogOpen(true); };
  const openEdit = (r: LostReason) => { setEditing(r); setName(r.name); setDialogOpen(true); };

  const save = async () => {
    if (!name.trim()) return toast.error('Informe o nome');
    try {
      if (editing) {
        await api.patch(`/lost-reasons/${editing.id}`, { name });
        toast.success('Motivo atualizado');
      } else {
        await api.post('/lost-reasons', { name });
        toast.success('Motivo criado');
      }
      setDialogOpen(false); fetch();
    } catch {
      toast.error('Erro ao salvar');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir motivo?')) return;
    await api.delete(`/lost-reasons/${id}`);
    fetch();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Motivos de Perda</h2>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo motivo</Button>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Lista fechada de motivos pra escolher quando marcar lead como perdido. Em vez de texto livre.
      </p>

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left font-medium px-4 py-2">Nome</th>
                <th className="text-right font-medium px-4 py-2 w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" size="icon-xs" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">Nenhum motivo cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar motivo' : 'Novo motivo'}</DialogTitle></DialogHeader>
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Sem orçamento" />
          </div>
          <DialogFooter>
            <Button onClick={save}>{editing ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
