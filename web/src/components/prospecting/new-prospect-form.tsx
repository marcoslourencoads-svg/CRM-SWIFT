'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  CAMPOS_DE_IDENTIFICACAO,
  CHANNEL_META,
  OUTCOME_META,
  paraInstante,
  proximoCompromissoPadrao,
  type ProspectApproach,
  type ProspectChannel,
  type ProspectList,
  type TouchOutcome,
} from '@/lib/prospecting';

interface Props {
  lists: ProspectList[];
  defaultListId?: string;
  onCreated: () => void;
  onCancel: () => void;
}

const EMPTY = {
  name: '',
  business: '',
  phone: '',
  email: '',
  handle: '',
  niche: '',
  observacao: '',
};

/**
 * Captura rápida.
 *
 * Nenhum campo é obrigatório sozinho: basta UM identificador — nome,
 * negócio, @, telefone ou e-mail. Em prospecção fria muitas vezes só se
 * tem o perfil, e exigir o nome levava o operador a inventar um só para
 * conseguir salvar. O resto se completa depois, na ficha.
 */
export function NewProspectForm({ lists, defaultListId, onCreated, onCancel }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [channel, setChannel] = useState<ProspectChannel>('INSTAGRAM');
  const [listId, setListId] = useState(defaultListId ?? lists[0]?.id ?? 'none');

  // Já abordei: registra o primeiro toque junto do cadastro, para não
  // ter que abrir a ficha logo em seguida só para marcar isso.
  const [jaAbordado, setJaAbordado] = useState(false);
  const [resultado, setResultado] = useState<TouchOutcome>('NO_REPLY');
  const [approachId, setApproachId] = useState('none');
  const [approaches, setApproaches] = useState<ProspectApproach[]>([]);

  const padrao = proximoCompromissoPadrao();
  const [data, setData] = useState(padrao.data);
  const [hora, setHora] = useState(padrao.hora);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get('/prospect-approaches')
      .then((res) =>
        setApproaches((res.data.data ?? []).filter((a: ProspectApproach) => a.isActive)),
      )
      .catch(() => {});
  }, []);

  function set(key: keyof typeof EMPTY, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Basta um identificador. A mesma regra vale no servidor; aqui ela
  // existe para avisar antes de o operador perder o que digitou.
  const temIdentificacao = CAMPOS_DE_IDENTIFICACAO.some((campo) =>
    (form[campo as keyof typeof EMPTY] ?? '').trim(),
  );

  async function handleSubmit() {
    if (!temIdentificacao) {
      toast.error('Preencha ao menos um: nome, negócio, @, telefone ou e-mail');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/prospects', {
        ...(form.name.trim() ? { name: form.name.trim() } : {}),
        ...(form.business.trim() ? { business: form.business.trim() } : {}),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.handle.trim() ? { handle: form.handle.trim() } : {}),
        ...(form.niche.trim() ? { niche: form.niche.trim() } : {}),
        ...(form.observacao.trim() ? { observacao: form.observacao.trim() } : {}),
        channel,
        ...(listId !== 'none' ? { listId } : {}),
        // Data e hora viram um instante em horário LOCAL. Montar com
        // `new Date('2026-09-05')` marcaria meia-noite UTC — 21h do dia
        // anterior no Brasil — e o cadastro nasceria atrasado.
        ...(data ? { nextActionAt: paraInstante(data, hora) } : {}),
        ...(jaAbordado
          ? {
              jaAbordado: true,
              primeiroToqueResultado: resultado,
              ...(approachId !== 'none' ? { approachId } : {}),
            }
          : {}),
      });
      toast.success(jaAbordado ? 'Prospect cadastrado e abordagem registrada' : 'Prospect adicionado');
      setForm(EMPTY);
      setJaAbordado(false);
      onCreated();
    } catch {
      toast.error('Não foi possível adicionar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-1 flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
          <Plus className="size-3.5" />
        </div>
        <h2 className="text-sm font-semibold uppercase tracking-wide">Novo prospect</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Basta um jeito de identificar — nome, negócio, @, telefone ou e-mail.
        O resto você completa depois, na ficha.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="np-name" className="text-xs">
            Nome do contato{' '}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="np-name"
            autoFocus
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Ex: Rafael Souza"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="np-business" className="text-xs">
            Negócio
          </Label>
          <Input
            id="np-business"
            value={form.business}
            onChange={(e) => set('business', e.target.value)}
            placeholder="Ex: Barbearia Imperial"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="np-niche" className="text-xs">
            Nicho
          </Label>
          <Input
            id="np-niche"
            value={form.niche}
            onChange={(e) => set('niche', e.target.value)}
            placeholder="Ex: Barbearia"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="np-phone" className="text-xs">
            Telefone / WhatsApp
          </Label>
          <Input
            id="np-phone"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="Ex: (19) 99999-8888"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="np-email" className="text-xs">
            E-mail
          </Label>
          <Input
            id="np-email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="Ex: rafael@barbearia.com"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="np-handle" className="text-xs">
            @ do Instagram
          </Label>
          <Input
            id="np-handle"
            value={form.handle}
            onChange={(e) => set('handle', e.target.value)}
            placeholder="Ex: @barbeariaimperial"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Canal</Label>
          <Select
            value={channel}
            onValueChange={(v) => setChannel((v ?? 'INSTAGRAM') as ProspectChannel)}
          >
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
          <Label className="text-xs">Lista</Label>
          <Select value={listId} onValueChange={(v) => setListId(v ?? 'none')}>
            <SelectTrigger>
              <SelectValue>
                {listId === 'none'
                  ? 'Sem lista'
                  : (lists.find((l) => l.id === listId)?.name ?? 'Lista')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem lista</SelectItem>
              {lists.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="np-data" className="text-xs">
            Próximo contato
          </Label>
          <div className="flex gap-1.5">
            <Input
              id="np-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
            <Input
              type="time"
              className="w-[7.5rem] shrink-0"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              aria-label="Hora do próximo contato"
            />
          </div>
        </div>
      </div>

      {/* Item 4: observação já no cadastro, para registrar o que foi
          avaliado sem ter que abrir a ficha depois. */}
      <div className="mt-3 space-y-1.5">
        <Label htmlFor="np-obs" className="text-xs">
          Observação
        </Label>
        <Textarea
          id="np-obs"
          value={form.observacao}
          onChange={(e) => set('observacao', e.target.value)}
          placeholder="O que você avaliou: faturamento, se anuncia, quem decide, o que chamou atenção..."
          className="min-h-16"
        />
        <p className="text-xs text-muted-foreground">
          Vira a primeira entrada do diário de bordo deste prospect.
        </p>
      </div>

      {/* Item 1: já abordei — registra o primeiro toque junto. */}
      <div
        className={cn(
          'mt-3 rounded-lg border p-3 transition-colors',
          jaAbordado && 'border-emerald-300 bg-emerald-50/40',
        )}
      >
        <div className="flex items-center gap-2.5">
          <Switch
            id="np-abordado"
            checked={jaAbordado}
            onCheckedChange={(v) => setJaAbordado(!!v)}
          />
          <Label htmlFor="np-abordado" className="cursor-pointer text-sm font-medium">
            <CheckCircle2
              className={cn(
                'mr-1 inline size-3.5',
                jaAbordado ? 'text-emerald-600' : 'text-muted-foreground',
              )}
            />
            Já abordei este contato
          </Label>
        </div>

        {jaAbordado ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Resultado da abordagem</Label>
              <Select
                value={resultado}
                onValueChange={(v) => setResultado((v ?? 'NO_REPLY') as TouchOutcome)}
              >
                <SelectTrigger>
                  <SelectValue>{OUTCOME_META[resultado].label}</SelectValue>
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

            <div className="space-y-1.5">
              <Label className="text-xs">Abordagem usada</Label>
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
            </div>
          </div>
        ) : (
          <p className="mt-1.5 pl-11 text-xs text-muted-foreground">
            Ligue se você já mandou a mensagem — o toque entra no histórico e a
            cadência começa a contar, sem precisar voltar aqui depois.
          </p>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={submitting || !temIdentificacao}
        >
          {submitting ? 'Adicionando...' : 'Adicionar prospect'}
        </Button>
      </div>
    </div>
  );
}
