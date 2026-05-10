'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const FIELD_OPTIONS = [
  { value: 'priority', label: 'Prioridade' },
  { value: 'temperature', label: 'Temperatura' },
  { value: 'estimatedValue', label: 'Valor estimado' },
  { value: 'title', label: 'Título' },
];

const OPERATOR_OPTIONS = [
  { value: 'EQUALS', label: 'igual a' },
  { value: 'NOT_EQUALS', label: 'diferente de' },
  { value: 'GREATER_THAN', label: 'maior que' },
  { value: 'LESS_THAN', label: 'menor que' },
  { value: 'CONTAINS', label: 'contém' },
  { value: 'IS_SET', label: 'está preenchido' },
  { value: 'IS_NOT_SET', label: 'está vazio' },
];

interface ScoringRule {
  id: string;
  name: string;
  condition: { field: string; operator: string; value?: unknown };
  points: number;
  isActive: boolean;
}

export default function ScoringPage() {
  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScoringRule | null>(null);
  const [name, setName] = useState('');
  const [field, setField] = useState('priority');
  const [operator, setOperator] = useState('EQUALS');
  const [value, setValue] = useState('');
  const [points, setPoints] = useState('10');

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/scoring/rules');
      setRules(res.data.data ?? []);
    } catch {
      toast.error('Erro ao carregar regras');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => {
    setEditing(null);
    setName(''); setField('priority'); setOperator('EQUALS'); setValue(''); setPoints('10');
    setDialogOpen(true);
  };

  const openEdit = (r: ScoringRule) => {
    setEditing(r);
    setName(r.name);
    setField(r.condition.field);
    setOperator(r.condition.operator);
    setValue(String(r.condition.value ?? ''));
    setPoints(String(r.points));
    setDialogOpen(true);
  };

  const save = async () => {
    if (!name.trim()) return toast.error('Informe o nome');
    const numericPoints = parseInt(points, 10) || 0;
    const condition: { field: string; operator: string; value?: string } = { field, operator };
    if (operator !== 'IS_SET' && operator !== 'IS_NOT_SET') {
      condition.value = value;
    }
    try {
      if (editing) {
        await api.patch(`/scoring/rules/${editing.id}`, { name, condition, points: numericPoints });
        toast.success('Regra atualizada');
      } else {
        await api.post('/scoring/rules', { name, condition, points: numericPoints });
        toast.success('Regra criada');
      }
      setDialogOpen(false); fetch();
    } catch {
      toast.error('Erro ao salvar');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir regra?')) return;
    await api.delete(`/scoring/rules/${id}`);
    fetch();
  };

  const recalculate = async () => {
    try {
      const res = await api.post('/scoring/recalculate', {});
      toast.success(`Recalculado em ${res.data.data?.recalculated ?? 0} leads`);
      fetch();
    } catch {
      toast.error('Erro ao recalcular');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-lg font-semibold">Lead Scoring</h2>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={recalculate}>
            <RefreshCw className="h-4 w-4 mr-1" /> Recalcular
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Nova Regra
          </Button>
        </div>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Regras somam pontos quando o lead bate na condição. Pontuação aparece como badge colorido no card (0-30 cinza, 31-60 amarelo, 61+ verde).
      </p>

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left font-medium px-4 py-2">Nome</th>
                <th className="text-left font-medium px-4 py-2">Condição</th>
                <th className="text-left font-medium px-4 py-2">Pontos</th>
                <th className="text-right font-medium px-4 py-2 w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {r.condition.field} {r.condition.operator} {String(r.condition.value ?? '')}
                  </td>
                  <td className="px-4 py-2">
                    <Badge className={r.points >= 0 ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}>
                      {r.points >= 0 ? '+' : ''}{r.points}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" size="icon-xs" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => remove(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    Nenhuma regra. Cria uma pra começar a pontuar leads.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar regra' : 'Nova regra'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome da regra</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Lead urgente vale mais" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Campo</Label>
                <Select value={field} onValueChange={(v) => setField(v ?? 'priority')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Operador</Label>
                <Select value={operator} onValueChange={(v) => setOperator(v ?? 'EQUALS')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPERATOR_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {operator !== 'IS_SET' && operator !== 'IS_NOT_SET' && (
              <div className="space-y-1">
                <Label>Valor</Label>
                <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex: HIGH, HOT, 100000" />
              </div>
            )}
            <div className="space-y-1">
              <Label>Pontos (positivo ou negativo)</Label>
              <Input type="number" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="10" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save}>{editing ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
