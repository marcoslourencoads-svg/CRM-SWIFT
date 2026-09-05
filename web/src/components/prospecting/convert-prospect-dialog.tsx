'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { displayName, type Prospect } from '@/lib/prospecting';

interface Pipeline {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospect: Prospect | null;
  onSuccess?: () => void;
}

/**
 * Promove o prospect a lead do pipeline de vendas.
 *
 * A partir daqui ele é tratado pela máquina que já existe (kanban,
 * automações, CAPI); o registro de prospecção continua guardando o
 * histórico de toques que produziu a oportunidade.
 */
export function ConvertProspectDialog({ open, onOpenChange, prospect, onSuccess }: Props) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineId, setPipelineId] = useState('');
  const [title, setTitle] = useState('');
  const [valueDisplay, setValueDisplay] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !prospect) return;
    setTitle(displayName(prospect));
    setValueDisplay(prospect.dealValue ? (prospect.dealValue / 100).toFixed(2).replace('.', ',') : '');
    api
      .get('/pipelines')
      .then((res) => {
        const list: Pipeline[] = res.data.data ?? [];
        setPipelines(list);
        setPipelineId((current) => current || list[0]?.id || '');
      })
      .catch(() => toast.error('Não foi possível carregar os pipelines'));
  }, [open, prospect]);

  if (!prospect) return null;

  async function handleSubmit() {
    if (!prospect) return;
    if (!pipelineId) {
      toast.error('Escolha um pipeline');
      return;
    }

    const reais = parseFloat(valueDisplay.replace(/\./g, '').replace(',', '.'));
    setSubmitting(true);
    try {
      await api.post(`/prospects/${prospect.id}/convert`, {
        pipelineId,
        title: title.trim() || displayName(prospect),
        ...(Number.isFinite(reais) && reais > 0 ? { estimatedValue: Math.round(reais * 100) } : {}),
      });
      toast.success('Prospect convertido em lead');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'Não foi possível converter';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Converter em lead</DialogTitle>
          <DialogDescription>
            Cria o contato e a oportunidade no pipeline de vendas, com origem
            &quot;Prospecção ativa&quot;. Os {prospect.touchCount} toque
            {prospect.touchCount === 1 ? '' : 's'} continuam registrados aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="convert-title">Título do lead</Label>
            <Input
              id="convert-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Pipeline</Label>
            <Select value={pipelineId} onValueChange={(v) => setPipelineId(v ?? '')}>
              <SelectTrigger>
                <SelectValue>
                  {pipelines.find((p) => p.id === pipelineId)?.name ?? 'Escolha o pipeline'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="convert-value">Valor estimado (R$)</Label>
            <Input
              id="convert-value"
              inputMode="decimal"
              value={valueDisplay}
              onChange={(e) => setValueDisplay(e.target.value)}
              placeholder="0,00"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Convertendo...' : 'Converter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
