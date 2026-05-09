'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';

interface PipelineStatus {
  id: string;
  name: string;
  isFinal: boolean;
  isWon: boolean;
}

interface MarkLostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  pipelineId: string;
  leadVersion: number;
  onSuccess?: () => void;
}

export function MarkLostDialog({
  open,
  onOpenChange,
  leadId,
  pipelineId,
  leadVersion,
  onSuccess,
}: MarkLostDialogProps) {
  const [statuses, setStatuses] = useState<PipelineStatus[]>([]);
  const [selectedStatusId, setSelectedStatusId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get(`/pipelines/${pipelineId}`).then((res) => {
      const list: PipelineStatus[] = res.data.data?.statuses ?? [];
      const lostStatuses = list.filter((s) => s.isFinal && !s.isWon);
      setStatuses(lostStatuses);
      if (lostStatuses.length > 0 && !selectedStatusId) {
        setSelectedStatusId(lostStatuses[0].id);
      }
    });
  }, [open, pipelineId, selectedStatusId]);

  const submit = async () => {
    if (!selectedStatusId) {
      toast.error('Selecione um status final.');
      return;
    }
    if (!reason.trim()) {
      toast.error('Informe o motivo da perda.');
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/leads/${leadId}/move`, { statusId: selectedStatusId });
      await api.patch(`/leads/${leadId}`, {
        lostReason: reason.trim(),
        version: leadVersion,
      });
      toast.success('Lead marcado como perdido');
      onOpenChange(false);
      setReason('');
      onSuccess?.();
    } catch {
      toast.error('Erro ao marcar lead como perdido');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como perdido</DialogTitle>
          <DialogDescription>
            O lead vai pra coluna final. Você pode recuperá-lo depois movendo-o
            de volta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Status final</Label>
            {statuses.length === 0 ? (
              <p className="text-xs text-amber-600">
                Nenhum status final &quot;perdido&quot; configurado neste pipeline.
                Crie um em Configurações → Pipelines.
              </p>
            ) : (
              <Select
                value={selectedStatusId}
                onValueChange={(val) => setSelectedStatusId(val ?? '')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1">
            <Label>Motivo da perda *</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Sem orçamento, escolheu concorrente, sumiu..."
              className="min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || statuses.length === 0}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {submitting ? 'Salvando...' : 'Marcar como perdido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
