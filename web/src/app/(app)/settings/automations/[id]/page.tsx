'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Save, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';

const TRIGGER_OPTIONS = [
  { value: 'LEAD_CREATED', label: 'Lead criado' },
  { value: 'STATUS_CHANGED', label: 'Status mudou' },
  { value: 'TAG_ADDED', label: 'Tag adicionada' },
  { value: 'TASK_COMPLETED', label: 'Tarefa concluída' },
  { value: 'LEAD_ASSIGNED', label: 'Lead atribuído' },
];

const ACTION_OPTIONS = [
  { value: 'ADD_TAG', label: 'Adicionar tag', paramHint: 'tagName' },
  { value: 'REMOVE_TAG', label: 'Remover tag', paramHint: 'tagId' },
  { value: 'CREATE_TASK', label: 'Criar tarefa', paramHint: 'title' },
  { value: 'CREATE_NOTE', label: 'Criar nota', paramHint: 'content' },
  { value: 'MOVE_TO_STATUS', label: 'Mover pra status', paramHint: 'statusId' },
  { value: 'ASSIGN_TO', label: 'Atribuir a', paramHint: 'assigneeId' },
  { value: 'SET_FIELD', label: 'Editar campo', paramHint: 'field + value' },
  { value: 'SEND_WEBHOOK', label: 'Disparar webhook', paramHint: 'url' },
  { value: 'SEND_WHATSAPP_TEMPLATE', label: 'WhatsApp template', paramHint: 'templateId' },
];

interface Action {
  type: string;
  params: Record<string, unknown>;
}

interface Pipeline {
  id: string;
  name: string;
}

export default function AutomationEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = params.id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);

  const [name, setName] = useState('');
  const [pipelineId, setPipelineId] = useState<string>('');
  const [triggerType, setTriggerType] = useState('LEAD_CREATED');
  const [actions, setActions] = useState<Action[]>([
    { type: 'CREATE_TASK', params: { title: '', dueDateOffsetMinutes: 60 } },
  ]);
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const res = await api.get(`/automations/${params.id}`);
      const r = res.data.data;
      setName(r.name);
      setPipelineId(r.pipelineId ?? '');
      setTriggerType(r.trigger?.type ?? 'LEAD_CREATED');
      setActions(r.actions ?? []);
      setIsActive(r.isActive);
    } catch {
      toast.error('Erro ao carregar automação');
    } finally {
      setLoading(false);
    }
  }, [isNew, params.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/pipelines').then((r) => setPipelines(r.data.data ?? [])).catch(() => {});
  }, []);

  const addAction = () => {
    setActions([...actions, { type: 'ADD_TAG', params: { tagName: '' } }]);
  };

  const removeAction = (idx: number) => {
    setActions(actions.filter((_, i) => i !== idx));
  };

  const updateAction = (idx: number, type: string) => {
    const next = [...actions];
    next[idx] = { type, params: {} };
    setActions(next);
  };

  const updateParam = (idx: number, key: string, value: unknown) => {
    const next = [...actions];
    next[idx] = { ...next[idx], params: { ...next[idx].params, [key]: value } };
    setActions(next);
  };

  const save = async () => {
    if (!name.trim()) return toast.error('Informe o nome');
    if (actions.length === 0) return toast.error('Adicione pelo menos uma ação');

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        pipelineId: pipelineId || null,
        trigger: { type: triggerType },
        conditions: [],
        actions,
        isActive,
      };
      if (isNew) {
        const res = await api.post('/automations', payload);
        toast.success('Automação criada');
        router.replace(`/settings/automations/${res.data.data.id}`);
      } else {
        await api.patch(`/automations/${params.id}`, payload);
        toast.success('Automação salva');
      }
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="max-w-3xl">
      <Link
        href="/settings/automations"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="size-3 mr-1" /> Voltar
      </Link>

      <h2 className="text-lg font-semibold mb-4">
        {isNew ? 'Nova automação' : 'Editar automação'}
      </h2>

      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Nome</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Boas-vindas a lead novo"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Pipeline (opcional)</Label>
            <Select value={pipelineId} onValueChange={(v) => setPipelineId(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Todos os pipelines" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os pipelines</SelectItem>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Quando (trigger)</Label>
            <Select value={triggerType} onValueChange={(v) => setTriggerType(v ?? 'LEAD_CREATED')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Ações (em ordem)</Label>
            <Button variant="outline" size="sm" onClick={addAction}>
              <Plus className="mr-1 size-3" /> Adicionar
            </Button>
          </div>
          <div className="space-y-2">
            {actions.map((a, idx) => (
              <div key={idx} className="rounded-lg border bg-muted/10 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5">#{idx + 1}</span>
                  <Select value={a.type} onValueChange={(v) => updateAction(idx, v ?? 'ADD_TAG')}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTION_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon-sm" onClick={() => removeAction(idx)}>
                    <X className="size-3.5" />
                  </Button>
                </div>

                {/* Param inputs por tipo */}
                <div className="mt-2 grid grid-cols-2 gap-2 pl-7">
                  {a.type === 'ADD_TAG' && (
                    <Input
                      value={(a.params.tagName as string) ?? ''}
                      onChange={(e) => updateParam(idx, 'tagName', e.target.value)}
                      placeholder="Nome da tag"
                      className="col-span-2"
                    />
                  )}
                  {a.type === 'CREATE_TASK' && (
                    <>
                      <Input
                        value={(a.params.title as string) ?? ''}
                        onChange={(e) => updateParam(idx, 'title', e.target.value)}
                        placeholder="Título da tarefa"
                      />
                      <Input
                        type="number"
                        value={(a.params.dueDateOffsetMinutes as number) ?? 60}
                        onChange={(e) => updateParam(idx, 'dueDateOffsetMinutes', Number(e.target.value))}
                        placeholder="Daqui a X minutos"
                      />
                    </>
                  )}
                  {a.type === 'CREATE_NOTE' && (
                    <Input
                      value={(a.params.content as string) ?? ''}
                      onChange={(e) => updateParam(idx, 'content', e.target.value)}
                      placeholder="Conteúdo da nota"
                      className="col-span-2"
                    />
                  )}
                  {a.type === 'MOVE_TO_STATUS' && (
                    <Input
                      value={(a.params.statusId as string) ?? ''}
                      onChange={(e) => updateParam(idx, 'statusId', e.target.value)}
                      placeholder="Status ID (CUID)"
                      className="col-span-2"
                    />
                  )}
                  {a.type === 'ASSIGN_TO' && (
                    <Input
                      value={(a.params.assigneeId as string) ?? ''}
                      onChange={(e) => updateParam(idx, 'assigneeId', e.target.value)}
                      placeholder="User ID do responsável"
                      className="col-span-2"
                    />
                  )}
                  {a.type === 'SEND_WEBHOOK' && (
                    <Input
                      value={(a.params.url as string) ?? ''}
                      onChange={(e) => updateParam(idx, 'url', e.target.value)}
                      placeholder="https://hooks.zapier.com/..."
                      className="col-span-2"
                    />
                  )}
                  {a.type === 'SEND_WHATSAPP_TEMPLATE' && (
                    <Input
                      value={(a.params.templateId as string) ?? ''}
                      onChange={(e) => updateParam(idx, 'templateId', e.target.value)}
                      placeholder="ID do template"
                      className="col-span-2"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="active" className="cursor-pointer">Automação ativa</Label>
        </div>

        <div className="flex justify-between border-t pt-4">
          {!isNew && (
            <Link href={`/settings/automations/${params.id}/logs`}>
              <Button variant="outline" size="sm">
                <FileText className="mr-1 size-3" /> Ver logs
              </Button>
            </Link>
          )}
          <div className="ml-auto">
            <Button onClick={save} disabled={saving}>
              <Save className="mr-1 size-3" />
              {saving ? 'Salvando...' : isNew ? 'Criar automação' : 'Salvar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
