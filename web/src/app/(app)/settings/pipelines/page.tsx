'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ColorPicker } from '@/components/ui/color-picker';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import api from '@/lib/api';

interface Status {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault?: boolean;
  isFinal?: boolean;
  isWon?: boolean;
  isMql?: boolean;
  isMeeting?: boolean;
}

interface Pipeline {
  id: string;
  name: string;
  description?: string;
  statuses: Status[];
}

// --- Status flags badges ---
function StatusFlags({ status }: { status: Status }) {
  const flags: { key: keyof Status; label: string }[] = [
    { key: 'isMql', label: 'MQL' },
    { key: 'isMeeting', label: 'Meeting' },
    { key: 'isFinal', label: 'Final' },
    { key: 'isWon', label: 'Won' },
    { key: 'isDefault', label: 'Default' },
  ];

  return (
    <div className="flex gap-1">
      {flags
        .filter((f) => status[f.key])
        .map((f) => (
          <Badge key={f.key} variant="secondary" className="text-[10px] px-1.5 py-0">
            {f.label}
          </Badge>
        ))}
    </div>
  );
}

// --- Edit status inline form ---
function EditStatusRow({
  status,
  onSave,
  onCancel,
}: {
  status: Status;
  onSave: (data: Partial<Status>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(status.name);
  const [color, setColor] = useState(status.color);
  const [isMql, setIsMql] = useState(status.isMql ?? false);
  const [isMeeting, setIsMeeting] = useState(status.isMeeting ?? false);
  const [isFinal, setIsFinal] = useState(status.isFinal ?? false);
  const [isWon, setIsWon] = useState(status.isWon ?? false);
  const [isDefault, setIsDefault] = useState(status.isDefault ?? false);

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 bg-muted/30">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-7 text-sm max-w-48"
          placeholder="Nome do status"
        />
        <ColorPicker value={color} onChange={setColor} size="sm" />
      </div>
      <div className="flex items-center gap-3 text-xs">
        {[
          { label: 'MQL', value: isMql, set: setIsMql },
          { label: 'Meeting', value: isMeeting, set: setIsMeeting },
          { label: 'Final', value: isFinal, set: setIsFinal },
          { label: 'Won', value: isWon, set: setIsWon },
          { label: 'Default', value: isDefault, set: setIsDefault },
        ].map((flag) => (
          <label key={flag.label} className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={flag.value}
              onChange={(e) => flag.set(e.target.checked)}
              className="rounded"
            />
            {flag.label}
          </label>
        ))}
      </div>
      <div className="flex gap-1">
        <Button
          size="xs"
          onClick={() =>
            onSave({ name, color, isMql, isMeeting, isFinal, isWon, isDefault })
          }
        >
          <Check className="h-3 w-3 mr-1" />
          Salvar
        </Button>
        <Button size="xs" variant="ghost" onClick={onCancel}>
          <X className="h-3 w-3 mr-1" />
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingStatus, setEditingStatus] = useState<string | null>(null);

  // New pipeline dialog
  const [showNewPipeline, setShowNewPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newPipelineDesc, setNewPipelineDesc] = useState('');

  // New status dialog
  const [addingStatusTo, setAddingStatusTo] = useState<string | null>(null);
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#6366f1');

  const fetchPipelines = useCallback(async () => {
    try {
      const res = await api.get('/pipelines');
      setPipelines(res.data.data);
    } catch {
      toast.error('Erro ao carregar pipelines');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // --- Pipeline CRUD ---
  const handleCreatePipeline = async () => {
    if (!newPipelineName.trim()) return;
    try {
      await api.post('/pipelines', {
        name: newPipelineName,
        description: newPipelineDesc || undefined,
      });
      toast.success('Pipeline criado');
      setShowNewPipeline(false);
      setNewPipelineName('');
      setNewPipelineDesc('');
      fetchPipelines();
    } catch {
      toast.error('Erro ao criar pipeline');
    }
  };

  const handleDeletePipeline = async (id: string) => {
    if (!confirm('Excluir este pipeline?')) return;
    try {
      await api.delete(`/pipelines/${id}`);
      toast.success('Pipeline excluído');
      fetchPipelines();
    } catch {
      toast.error('Erro ao excluir pipeline');
    }
  };

  // --- Status CRUD ---
  const handleAddStatus = async (pipelineId: string) => {
    if (!newStatusName.trim()) return;
    try {
      await api.post(`/pipelines/${pipelineId}/statuses`, {
        name: newStatusName,
        color: newStatusColor,
      });
      toast.success('Status criado');
      setAddingStatusTo(null);
      setNewStatusName('');
      setNewStatusColor('#6366f1');
      fetchPipelines();
    } catch {
      toast.error('Erro ao criar status');
    }
  };

  const handleUpdateStatus = async (
    statusId: string,
    data: Partial<Status>,
  ) => {
    try {
      await api.patch(`/statuses/${statusId}`, data);
      toast.success('Status atualizado');
      setEditingStatus(null);
      fetchPipelines();
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    if (!confirm('Excluir este status?')) return;
    try {
      await api.delete(`/statuses/${statusId}`);
      toast.success('Status excluído');
      fetchPipelines();
    } catch {
      toast.error('Erro ao excluir status');
    }
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-4">Pipelines</h2>
        <div className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Pipelines</h2>
        <Button size="sm" onClick={() => setShowNewPipeline(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Pipeline
        </Button>
      </div>

      <div className="space-y-3">
        {pipelines.map((pipeline) => {
          const isOpen = expanded[pipeline.id] ?? false;
          const sortedStatuses = [...pipeline.statuses].sort(
            (a, b) => a.position - b.position,
          );

          return (
            <Card key={pipeline.id} className="overflow-hidden">
              {/* Pipeline header */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleExpanded(pipeline.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleExpanded(pipeline.id);
                  }
                }}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform text-muted-foreground',
                      isOpen && 'rotate-180',
                    )}
                  />
                  <span className="font-medium text-sm">{pipeline.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({pipeline.statuses.length} status)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePipeline(pipeline.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>

              {/* Expanded status list */}
              {isOpen && (
                <div className="border-t px-4 py-3 space-y-2">
                  {sortedStatuses.map((status) =>
                    editingStatus === status.id ? (
                      <EditStatusRow
                        key={status.id}
                        status={status}
                        onSave={(data) =>
                          handleUpdateStatus(status.id, data)
                        }
                        onCancel={() => setEditingStatus(null)}
                      />
                    ) : (
                      <div
                        key={status.id}
                        className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/30 group"
                      >
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: status.color }}
                        />
                        <span className="text-sm flex-1">{status.name}</span>
                        <StatusFlags status={status} />
                        <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setEditingStatus(status.id)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleDeleteStatus(status.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ),
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 text-muted-foreground"
                    onClick={() => setAddingStatusTo(pipeline.id)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Adicionar Status
                  </Button>
                </div>
              )}
            </Card>
          );
        })}

        {pipelines.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum pipeline cadastrado.
          </p>
        )}
      </div>

      {/* New Pipeline Dialog */}
      <Dialog open={showNewPipeline} onOpenChange={setShowNewPipeline}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                placeholder="Ex: Vendas B2B"
              />
            </div>
            <div className="space-y-1">
              <Label>Descrição (opcional)</Label>
              <Input
                value={newPipelineDesc}
                onChange={(e) => setNewPipelineDesc(e.target.value)}
                placeholder="Descrição do pipeline"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreatePipeline}>Criar Pipeline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Status Dialog */}
      <Dialog
        open={addingStatusTo !== null}
        onOpenChange={(open) => {
          if (!open) setAddingStatusTo(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input
                value={newStatusName}
                onChange={(e) => setNewStatusName(e.target.value)}
                placeholder="Ex: Qualificado"
              />
            </div>
            <div className="space-y-1">
              <Label>Cor</Label>
              <ColorPicker value={newStatusColor} onChange={setNewStatusColor} />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addingStatusTo && handleAddStatus(addingStatusTo)}
            >
              Criar Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
