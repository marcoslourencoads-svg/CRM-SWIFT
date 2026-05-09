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
import { Input } from '@/components/ui/input';
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

interface MarkWonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  pipelineId: string;
  leadVersion: number;
  currentEstimatedValue: number;
  onSuccess?: () => void;
}

export function MarkWonDialog({
  open,
  onOpenChange,
  leadId,
  pipelineId,
  leadVersion,
  currentEstimatedValue,
  onSuccess,
}: MarkWonDialogProps) {
  const [statuses, setStatuses] = useState<PipelineStatus[]>([]);
  const [selectedStatusId, setSelectedStatusId] = useState<string>('');
  const [valueDisplay, setValueDisplay] = useState(
    (currentEstimatedValue / 100).toFixed(2).replace('.', ','),
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValueDisplay((currentEstimatedValue / 100).toFixed(2).replace('.', ','));
    api.get(`/pipelines/${pipelineId}`).then((res) => {
      const list: PipelineStatus[] = res.data.data?.statuses ?? [];
      const wonStatuses = list.filter((s) => s.isFinal && s.isWon);
      setStatuses(wonStatuses);
      if (wonStatuses.length > 0 && !selectedStatusId) {
        setSelectedStatusId(wonStatuses[0].id);
      }
    });
  }, [open, pipelineId, currentEstimatedValue, selectedStatusId]);

  const submit = async () => {
    if (!selectedStatusId) {
      toast.error('Selecione um status final.');
      return;
    }
    setSubmitting(true);
    try {
      const cents = Math.round(
        parseFloat(valueDisplay.replace(/[^\d,]/g, '').replace(',', '.')) * 100 || 0,
      );

      if (cents !== currentEstimatedValue) {
        await api.patch(`/leads/${leadId}`, {
          estimatedValue: cents,
          version: leadVersion,
        });
      }
      await api.patch(`/leads/${leadId}/move`, { statusId: selectedStatusId });

      toast.success('Lead marcado como ganho 🎉');
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error('Erro ao marcar lead como ganho');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como ganho 🎉</DialogTitle>
          <DialogDescription>
            Confirme o valor da venda e a etapa final.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Status final</Label>
            {statuses.length === 0 ? (
              <p className="text-xs text-amber-600">
                Nenhum status final &quot;ganho&quot; configurado neste pipeline.
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
            <Label>Valor da venda (R$)</Label>
            <Input
              value={valueDisplay}
              onChange={(e) => setValueDisplay(e.target.value)}
              placeholder="0,00"
            />
            <p className="text-xs text-muted-foreground">
              Atualiza o &quot;Valor estimado&quot; do lead com o valor real de fechamento.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || statuses.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? 'Salvando...' : 'Marcar como ganho'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
