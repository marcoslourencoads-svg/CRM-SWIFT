'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Zap, Play, Pause, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';

interface AutomationRule {
  id: string;
  name: string;
  pipelineId: string | null;
  trigger: { type: string; params?: Record<string, unknown> };
  conditions: unknown[];
  actions: { type: string }[];
  isActive: boolean;
  executionCount: number;
  lastExecutedAt: string | null;
  createdAt: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  LEAD_CREATED: 'Lead criado',
  STATUS_CHANGED: 'Status mudou',
  TAG_ADDED: 'Tag adicionada',
  TASK_COMPLETED: 'Tarefa concluída',
  LEAD_ASSIGNED: 'Lead atribuído',
};

const ACTION_LABELS: Record<string, string> = {
  MOVE_TO_STATUS: 'Mover pra status',
  ASSIGN_TO: 'Atribuir a',
  ADD_TAG: 'Adicionar tag',
  REMOVE_TAG: 'Remover tag',
  SET_FIELD: 'Editar campo',
  SET_CUSTOM_FIELD: 'Editar campo custom',
  CREATE_TASK: 'Criar tarefa',
  CREATE_NOTE: 'Criar nota',
  SEND_NOTIFICATION: 'Enviar notificação',
  SEND_WEBHOOK: 'Disparar webhook',
  SEND_WHATSAPP_TEMPLATE: 'WhatsApp template',
};

export default function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/automations');
      setRules(res.data.data ?? []);
    } catch {
      toast.error('Erro ao carregar automações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const toggle = async (rule: AutomationRule) => {
    try {
      await api.patch(`/automations/${rule.id}`, { isActive: !rule.isActive });
      toast.success(rule.isActive ? 'Automação pausada' : 'Automação ativada');
      fetch();
    } catch {
      toast.error('Erro ao alternar');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta automação?')) return;
    try {
      await api.delete(`/automations/${id}`);
      toast.success('Automação excluída');
      fetch();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Automações</h2>
        <div className="flex gap-1">
          <Link href="/settings/automations/templates">
            <Button variant="outline" size="sm">
              <BookOpen className="mr-1 size-3" />
              Templates
            </Button>
          </Link>
          <Link href="/settings/automations/new">
            <Button size="sm">
              <Plus className="mr-1 size-3" />
              Nova automação
            </Button>
          </Link>
        </div>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Quando um evento acontece (lead criado, status muda, tag adicionada, tarefa concluída),
        executa ações automaticamente (criar tarefa, mover lead, mandar webhook, etc).
      </p>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : rules.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-12 text-center">
          <Zap className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="mb-3 text-sm text-muted-foreground">
            Nenhuma automação ainda. Crie a partir de um template ou do zero.
          </p>
          <Link href="/settings/automations/templates">
            <Button variant="outline" size="sm">Ver templates</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border p-3 hover:bg-muted/20"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium ${!r.isActive ? 'text-muted-foreground line-through' : ''}`}>
                      {r.name}
                    </p>
                    {r.isActive ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Ativa</Badge>
                    ) : (
                      <Badge variant="outline">Pausada</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Quando: <strong>{TRIGGER_LABELS[r.trigger?.type] ?? r.trigger?.type}</strong>
                    {' → '}
                    Ações: {r.actions.map((a) => ACTION_LABELS[a.type] ?? a.type).join(', ') || '—'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Executou {r.executionCount}x
                    {r.lastExecutedAt && ` · última: ${new Date(r.lastExecutedAt).toLocaleString('pt-BR')}`}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => toggle(r)}
                    title={r.isActive ? 'Pausar' : 'Ativar'}
                  >
                    {r.isActive ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                  </Button>
                  <Link href={`/settings/automations/${r.id}`}>
                    <Button variant="ghost" size="icon-xs">
                      <Pencil className="size-3.5" />
                    </Button>
                  </Link>
                  <Button variant="ghost" size="icon-xs" onClick={() => remove(r.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
