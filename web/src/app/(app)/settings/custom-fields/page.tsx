'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
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

const FIELD_TYPES = [
  { value: 'TEXT', label: 'Texto' },
  { value: 'TEXTAREA', label: 'Texto longo' },
  { value: 'NUMBER', label: 'Número' },
  { value: 'CURRENCY', label: 'Moeda' },
  { value: 'PERCENTAGE', label: 'Porcentagem' },
  { value: 'RATING', label: 'Avaliação' },
  { value: 'DATE', label: 'Data' },
  { value: 'DATETIME', label: 'Data/hora' },
  { value: 'SELECT', label: 'Lista (escolha única)' },
  { value: 'MULTI_SELECT', label: 'Lista (múltipla)' },
  { value: 'CHECKBOX', label: 'Sim/Não' },
  { value: 'URL', label: 'URL' },
  { value: 'PHONE', label: 'Telefone' },
  { value: 'EMAIL', label: 'Email' },
];

interface Pipeline {
  id: string;
  name: string;
}

interface FieldDefinition {
  id: string;
  pipelineId: string;
  name: string;
  slug: string;
  type: string;
  options: string[] | null;
  defaultValue: string | null;
  isRequired: boolean;
  isVisibleOnCard: boolean;
  isFilterable: boolean;
  position: number;
}


export default function CustomFieldsPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('TEXT');
  const [options, setOptions] = useState<string[]>([]);
  const [optionDraft, setOptionDraft] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [isVisibleOnCard, setIsVisibleOnCard] = useState(false);

  const fetchPipelines = useCallback(async () => {
    try {
      const res = await api.get('/pipelines');
      const list: Pipeline[] = res.data.data ?? [];
      setPipelines(list);
      if (list.length > 0 && !selectedPipelineId) {
        setSelectedPipelineId(list[0].id);
      }
    } catch {
      toast.error('Erro ao carregar pipelines');
    }
  }, [selectedPipelineId]);

  const fetchFields = useCallback(async (pipelineId: string) => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const res = await api.get(`/pipelines/${pipelineId}/custom-fields`);
      setFields(res.data.data ?? []);
    } catch {
      toast.error('Erro ao carregar campos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  useEffect(() => {
    if (selectedPipelineId) fetchFields(selectedPipelineId);
  }, [selectedPipelineId, fetchFields]);

  const openCreate = () => {
    setEditingField(null);
    setName('');
    setType('TEXT');
    setOptions([]);
    setOptionDraft('');
    setIsRequired(false);
    setIsVisibleOnCard(false);
    setDialogOpen(true);
  };

  const openEdit = (field: FieldDefinition) => {
    setEditingField(field);
    setName(field.name);
    setType(field.type);
    setOptions(field.options ?? []);
    setOptionDraft('');
    setIsRequired(field.isRequired);
    setIsVisibleOnCard(field.isVisibleOnCard);
    setDialogOpen(true);
  };

  const addOption = () => {
    const trimmed = optionDraft.trim();
    if (!trimmed || options.includes(trimmed)) return;
    setOptions([...options, trimmed]);
    setOptionDraft('');
  };

  const removeOption = (opt: string) => {
    setOptions(options.filter((o) => o !== opt));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Informe o nome do campo');
      return;
    }
    if ((type === 'SELECT' || type === 'MULTI_SELECT') && options.length === 0) {
      toast.error('Adicione pelo menos uma opção');
      return;
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      type,
      isRequired,
      isVisibleOnCard,
    };
    if (type === 'SELECT' || type === 'MULTI_SELECT') {
      payload.options = options;
    }

    try {
      if (editingField) {
        await api.patch(`/custom-fields/${editingField.id}`, payload);
        toast.success('Campo atualizado');
      } else {
        await api.post(`/pipelines/${selectedPipelineId}/custom-fields`, payload);
        toast.success('Campo criado');
      }
      setDialogOpen(false);
      fetchFields(selectedPipelineId);
    } catch {
      toast.error('Erro ao salvar campo');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este campo? Os valores cadastrados nos leads também serão removidos.')) return;
    try {
      await api.delete(`/custom-fields/${id}`);
      toast.success('Campo excluído');
      fetchFields(selectedPipelineId);
    } catch {
      toast.error('Erro ao excluir campo');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4">
        <h2 className="text-lg font-semibold">Campos Adicionais</h2>
        <div className="flex items-center gap-2">
          <Select
            value={selectedPipelineId}
            onValueChange={(val) => setSelectedPipelineId(val ?? '')}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Selecione um pipeline" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openCreate} disabled={!selectedPipelineId}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Campo
          </Button>
        </div>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Campos adicionais são informações personalizadas que aparecem em cada lead deste pipeline.
        Use pra capturar coisas como nicho, faturamento, segmento, etc.
      </p>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left font-medium px-4 py-2">Nome</th>
                <th className="text-left font-medium px-4 py-2">Tipo</th>
                <th className="text-left font-medium px-4 py-2">Opções</th>
                <th className="text-left font-medium px-4 py-2">Obrigatório</th>
                <th className="text-right font-medium px-4 py-2 w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.id} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="px-4 py-2 font-medium">{field.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {FIELD_TYPES.find((t) => t.value === field.type)?.label ?? field.type}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {field.options?.length
                      ? field.options.slice(0, 3).join(', ') + (field.options.length > 3 ? '...' : '')
                      : '—'}
                  </td>
                  <td className="px-4 py-2">
                    {field.isRequired ? (
                      <Badge className="bg-red-500/10 text-red-700 hover:bg-red-500/10">Sim</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="icon-xs" onClick={() => openEdit(field)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(field.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {fields.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    Nenhum campo cadastrado neste pipeline.
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
            <DialogTitle>{editingField ? 'Editar campo' : 'Novo campo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Faturamento mensal"
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select
                value={type}
                onValueChange={(val) => setType(val ?? 'TEXT')}
                disabled={!!editingField}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!!editingField && (
                <p className="text-xs text-muted-foreground">
                  O tipo não pode ser alterado depois de criar.
                </p>
              )}
            </div>

            {(type === 'SELECT' || type === 'MULTI_SELECT') && (
              <div className="space-y-1">
                <Label>Opções</Label>
                <div className="flex gap-1">
                  <Input
                    value={optionDraft}
                    onChange={(e) => setOptionDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addOption();
                      }
                    }}
                    placeholder="Adicionar opção e pressionar Enter"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addOption}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 pt-2">
                  {options.map((opt) => (
                    <Badge
                      key={opt}
                      variant="outline"
                      className="gap-1 pr-1"
                    >
                      {opt}
                      <button
                        type="button"
                        onClick={() => removeOption(opt)}
                        className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="required"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="required" className="cursor-pointer">
                  Obrigatório
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="visible-card"
                  checked={isVisibleOnCard}
                  onChange={(e) => setIsVisibleOnCard(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="visible-card" className="cursor-pointer">
                  Mostrar no card do kanban
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave}>{editingField ? 'Salvar' : 'Criar campo'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
