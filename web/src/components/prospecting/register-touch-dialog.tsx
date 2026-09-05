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
import {
  CHANNEL_META,
  OUTCOME_META,
  nextTouchLabel,
  type Prospect,
  type ProspectApproach,
  type ProspectChannel,
  type TouchOutcome,
} from '@/lib/prospecting';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospect: Prospect | null;
  onSuccess?: () => void;
}

/**
 * Registra um toque da cadência.
 *
 * O próximo follow-up é agendado pelo servidor a partir da cadência da
 * lista — o operador não digita data nenhuma, que era justamente o que
 * fazia a planilha nunca responder "quem eu toco hoje?".
 */
export function RegisterTouchDialog({ open, onOpenChange, prospect, onSuccess }: Props) {
  const [approaches, setApproaches] = useState<ProspectApproach[]>([]);
  const [approachId, setApproachId] = useState('none');
  const [channel, setChannel] = useState<ProspectChannel>('INSTAGRAM');
  const [outcome, setOutcome] = useState<TouchOutcome>('NO_REPLY');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !prospect) return;
    setChannel(prospect.channel);
    setOutcome('NO_REPLY');
    setMessage('');
    setApproachId('none');
    api
      .get('/prospect-approaches')
      .then((res) => setApproaches((res.data.data ?? []).filter((a: ProspectApproach) => a.isActive)))
      .catch(() => {});
  }, [open, prospect]);

  if (!prospect) return null;

  const cadence = prospect.list?.cadenceDays ?? [];
  const proximoIntervalo = cadence[prospect.touchCount];
  const replied = outcome === 'REPLIED_POSITIVE' || outcome === 'REPLIED_NEGATIVE';

  async function handleSubmit() {
    if (!prospect) return;
    setSubmitting(true);
    try {
      await api.post(`/prospects/${prospect.id}/touches`, {
        channel,
        outcome,
        ...(approachId !== 'none' ? { approachId } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      toast.success(`${nextTouchLabel(prospect)} registrado`);
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error('Não foi possível registrar o toque');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Registrar {nextTouchLabel(prospect).toLowerCase()}
          </DialogTitle>
          <DialogDescription>
            Toque {prospect.touchCount + 1} de {prospect.business || prospect.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={channel} onValueChange={(v) => setChannel((v ?? 'INSTAGRAM') as ProspectChannel)}>
                <SelectTrigger>
                  <SelectValue>{CHANNEL_META[channel].label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHANNEL_META).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Resultado</Label>
              <Select value={outcome} onValueChange={(v) => setOutcome((v ?? 'NO_REPLY') as TouchOutcome)}>
                <SelectTrigger>
                  <SelectValue>{OUTCOME_META[outcome].label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OUTCOME_META).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {prospect.touchCount === 0 && (
            <div className="space-y-1.5">
              <Label>Abordagem usada</Label>
              <Select value={approachId} onValueChange={(v) => setApproachId(v ?? 'none')}>
                <SelectTrigger>
                  <SelectValue>
                    {approachId === 'none'
                      ? 'Não informar'
                      : (approaches.find((a) => a.id === approachId)?.name ?? 'Abordagem')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informar</SelectItem>
                  {approaches.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                É o que permite comparar a conversão de cada script depois.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="touch-message">Mensagem enviada (opcional)</Label>
            <Input
              id="touch-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Cole o que você mandou"
            />
          </div>

          {/* Deixa explícito o que o sistema vai fazer sozinho, para o
              operador não procurar um campo de data que não existe. */}
          <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {replied
              ? 'Com resposta registrada, a cadência para aqui e o prospect vai para "Respondeu".'
              : proximoIntervalo !== undefined
                ? `O próximo follow-up será agendado automaticamente para daqui a ${proximoIntervalo} dia${proximoIntervalo > 1 ? 's' : ''}.`
                : 'Este é o último toque da cadência desta lista — depois dele o prospect fica marcado como "cadência esgotada".'}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Registrando...' : 'Registrar toque'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
