'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, ExternalLink, NotebookPen, Send, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  BOARD_STAGES,
  CHANNEL_META,
  OUTCOME_META,
  STAGE_META,
  contactLink,
  displayName,
  formatFullDateBR,
  toDateInput,
  toTimeInput,
  paraInstante,
  formatCompromisso,
  type Prospect,
  type ProspectChannel,
  type ProspectStage,
} from '@/lib/prospecting';
import { RegisterTouchDialog } from './register-touch-dialog';
import { ConvertProspectDialog } from './convert-prospect-dialog';

interface LostReason {
  id: string;
  name: string;
}

interface Props {
  prospectId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

/** A "ficha": tudo o que a linha da planilha guardava, mais a trilha de toques. */
export function ProspectDrawer({ prospectId, onOpenChange, onChanged }: Props) {
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touchOpen, setTouchOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [lostReasons, setLostReasons] = useState<LostReason[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [novaNota, setNovaNota] = useState('');
  const [salvandoNota, setSalvandoNota] = useState(false);

  const load = useCallback(async () => {
    if (!prospectId) return;
    setLoading(true);
    try {
      const res = await api.get(`/prospects/${prospectId}`);
      const p: Prospect = res.data.data;
      setProspect(p);
      setForm({
        name: p.name ?? '',
        business: p.business ?? '',
        handle: p.handle ?? '',
        phone: p.phone ?? '',
        email: p.email ?? '',
        niche: p.niche ?? '',
        city: p.city ?? '',
        nextActionAt: toDateInput(p.nextActionAt),
        nextActionTime: toTimeInput(p.nextActionAt) || '09:00',
        hasAds: p.hasAds === null ? 'unknown' : String(p.hasAds),
        channel: p.channel,
      });
    } catch {
      toast.error('Não foi possível carregar o prospect');
    } finally {
      setLoading(false);
    }
  }, [prospectId]);

  useEffect(() => {
    if (prospectId) {
      load();
      api
        .get('/lost-reasons')
        .then((res) => setLostReasons(res.data.data ?? []))
        .catch(() => {});
    } else {
      setProspect(null);
    }
  }, [prospectId, load]);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!prospect) return;
    setSaving(true);
    try {
      await api.patch(`/prospects/${prospect.id}`, {
        name: form.name.trim() || prospect.name,
        business: form.business.trim(),
        handle: form.handle.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        niche: form.niche.trim(),
        city: form.city.trim(),

        channel: form.channel as ProspectChannel,
        ...(form.hasAds !== 'unknown' ? { hasAds: form.hasAds === 'true' } : {}),
        // Data + hora lidas como horário LOCAL. Com `new Date(data)` a
        // gravação virava meia-noite UTC e o compromisso nascia vencido.
        nextActionAt: form.nextActionAt
          ? paraInstante(form.nextActionAt, form.nextActionTime)
          : undefined,
      });
      toast.success('Ficha atualizada');
      await load();
      onChanged?.();
    } catch {
      toast.error('Não foi possível salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleStage(stage: ProspectStage, lostReasonId?: string) {
    if (!prospect) return;
    try {
      await api.patch(`/prospects/${prospect.id}/stage`, {
        stage,
        ...(lostReasonId ? { lostReasonId } : {}),
      });
      toast.success(`Movido para ${STAGE_META[stage].label}`);
      await load();
      onChanged?.();
    } catch {
      toast.error('Não foi possível mudar a etapa');
    }
  }

  async function handleAddNote() {
    if (!prospect || !novaNota.trim()) return;
    setSalvandoNota(true);
    try {
      await api.post(`/prospects/${prospect.id}/notes`, { content: novaNota.trim() });
      setNovaNota('');
      toast.success('Anotação salva');
      await load();
      onChanged?.();
    } catch {
      toast.error('Não foi possível salvar a anotação');
    } finally {
      setSalvandoNota(false);
    }
  }

  async function handleRemoveNote(noteId: string) {
    try {
      await api.delete(`/prospect-notes/${noteId}`);
      await load();
    } catch {
      toast.error('Não foi possível remover a anotação');
    }
  }

  async function handleDelete() {
    if (!prospect) return;
    try {
      await api.delete(`/prospects/${prospect.id}`);
      toast.success('Prospect removido');
      onOpenChange(false);
      onChanged?.();
    } catch {
      toast.error('Não foi possível remover');
    }
  }

  const link = prospect ? contactLink(prospect) : null;

  return (
    <>
      <Sheet open={!!prospectId} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full overflow-y-auto sm:max-w-[520px]"
        >
          {loading || !prospect ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="space-y-5 p-6">
              <SheetHeader className="flex-row items-start justify-between gap-2 p-0">
                <div className="min-w-0">
                  <SheetTitle className="truncate text-left">
                    {displayName(prospect)}
                  </SheetTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-medium',
                        STAGE_META[prospect.stage].badge,
                      )}
                    >
                      {STAGE_META[prospect.stage].label}
                    </span>
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-2.5" />
                        Abrir conversa
                      </a>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                  <X className="size-4" />
                </Button>
              </SheetHeader>

              {/* Ações do dia */}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setTouchOpen(true)}>
                  <Send className="mr-1 size-3.5" />
                  Registrar toque
                </Button>
                {!prospect.leadId && (
                  <Button size="sm" variant="outline" onClick={() => setConvertOpen(true)}>
                    <ArrowRight className="mr-1 size-3.5" />
                    Converter em lead
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={handleDelete}>
                  <Trash2 className="mr-1 size-3.5" />
                  Remover
                </Button>
              </div>

              <Separator />

              {/* Etapa */}
              <div className="space-y-1.5">
                <Label>Etapa</Label>
                <Select
                  value={prospect.stage}
                  onValueChange={(v) => v && handleStage(v as ProspectStage)}
                >
                  <SelectTrigger>
                    <SelectValue>{STAGE_META[prospect.stage].label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {[...BOARD_STAGES, 'DISQUALIFIED' as ProspectStage].map((s) => (
                      <SelectItem key={s} value={s}>
                        {STAGE_META[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(prospect.stage === 'LOST' || prospect.stage === 'DISQUALIFIED') && (
                <div className="space-y-1.5">
                  <Label>Motivo da perda</Label>
                  <Select
                    value={prospect.lostReasonId ?? 'none'}
                    onValueChange={(v) =>
                      handleStage(prospect.stage, !v || v === 'none' ? undefined : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {lostReasons.find((r) => r.id === prospect.lostReasonId)?.name ??
                          'Sem motivo'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem motivo</SelectItem>
                      {lostReasons.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Motivo do catálogo, não texto livre — é o que permite agregar
                    as perdas no funil.
                  </p>
                </div>
              )}

              <Separator />

              {/* Diário de bordo — item 3. Antes era um campo de uma
                  linha só, e cada edição apagava a anterior. Aqui cada
                  anotação fica com data, autor e a etapa em que estava. */}
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <NotebookPen className="size-3.5 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">
                    Observações ({prospect.notes.length})
                  </h3>
                </div>

                <Textarea
                  value={novaNota}
                  onChange={(e) => setNovaNota(e.target.value)}
                  placeholder="O que foi visto, o que foi tratado, o que ficou de fazer..."
                  className="min-h-20"
                />
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Fica salvo na etapa &quot;{STAGE_META[prospect.stage].label}&quot;.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleAddNote}
                    disabled={salvandoNota || !novaNota.trim()}
                  >
                    {salvandoNota ? 'Salvando...' : 'Anotar'}
                  </Button>
                </div>

                {prospect.notes.length > 0 && (
                  <ol className="mt-3 space-y-2">
                    {prospect.notes.map((n) => (
                      <li key={n.id} className="rounded-md border p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-medium',
                              STAGE_META[n.stage].badge,
                            )}
                          >
                            {STAGE_META[n.stage].short}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatFullDateBR(n.createdAt)}
                            {n.user ? ` · ${n.user.name}` : ''}
                          </span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-xs">{n.content}</p>
                        <button
                          onClick={() => handleRemoveNote(n.id)}
                          className="mt-1 text-[10px] text-muted-foreground hover:text-destructive"
                        >
                          remover
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <Separator />

              {/* Trilha de toques */}
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  Toques ({prospect.touches.length})
                </h3>
                {prospect.touches.length === 0 ? (
                  <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    Nenhum toque ainda. O primeiro registro marca a abordagem e
                    inicia a cadência.
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {prospect.touches.map((t) => (
                      <li key={t.id} className="rounded-md border p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">
                            {t.sequence === 1 ? 'Abordagem' : `FUP ${t.sequence - 1}`}
                            <span className="ml-1.5 font-normal text-muted-foreground">
                              {CHANNEL_META[t.channel]?.label}
                            </span>
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatFullDateBR(t.sentAt)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-medium',
                              OUTCOME_META[t.outcome].badge,
                            )}
                          >
                            {OUTCOME_META[t.outcome].label}
                          </span>
                          {t.approach && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {t.approach.name}
                            </span>
                          )}
                        </div>
                        {t.message && (
                          <p className="mt-1.5 text-xs text-muted-foreground">{t.message}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <Separator />

              {/* Linha do tempo do funil */}
              <div>
                <h3 className="mb-2 text-sm font-semibold">Linha do tempo</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {(
                    [
                      ['Abordado em', prospect.firstContactedAt],
                      ['Respondeu em', prospect.respondedAt],
                      ['Reunião agendada', prospect.meetingSetAt],
                      ['Reunião realizada', prospect.meetingHeldAt],
                      ['Fechou em', prospect.wonAt],
                      ['Perdido em', prospect.lostAt],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className={value ? 'font-medium' : 'text-muted-foreground'}>
                        {formatFullDateBR(value)}
                      </dd>
                    </div>
                  ))}
                  {prospect.dealValue > 0 && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Valor</dt>
                      <dd className="font-medium">{formatCurrency(prospect.dealValue)}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <Separator />

              {/* Campos da ficha */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Dados</h3>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome do contato" value={form.name} onChange={(v) => set('name', v)} />
                  <Field label="Negócio" value={form.business} onChange={(v) => set('business', v)} />
                  <Field label="Nicho" value={form.niche} onChange={(v) => set('niche', v)} />
                  <Field label="Cidade" value={form.city} onChange={(v) => set('city', v)} />
                  <Field label="@ do Instagram" value={form.handle} onChange={(v) => set('handle', v)} />
                  <Field label="Telefone" value={form.phone} onChange={(v) => set('phone', v)} />
                  <Field label="E-mail" value={form.email} onChange={(v) => set('email', v)} />

                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Próximo contato</Label>
                    <div className="flex gap-1.5">
                      <Input
                        type="date"
                        value={form.nextActionAt}
                        onChange={(e) => set('nextActionAt', e.target.value)}
                      />
                      <Input
                        type="time"
                        className="w-[7.5rem] shrink-0"
                        value={form.nextActionTime}
                        onChange={(e) => set('nextActionTime', e.target.value)}
                        aria-label="Hora do próximo contato"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O sino avisa 30 minutos antes, e o compromisso aparece no
                      calendário e na fila do dia.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Canal</Label>
                    <Select value={form.channel} onValueChange={(v) => set('channel', v ?? 'INSTAGRAM')}>
                      <SelectTrigger>
                        <SelectValue>
                          {CHANNEL_META[form.channel as ProspectChannel]?.label ?? 'Canal'}
                        </SelectValue>
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
                    <Label className="text-xs">Tem anúncio?</Label>
                    <Select value={form.hasAds} onValueChange={(v) => set('hasAds', v ?? 'unknown')}>
                      <SelectTrigger>
                        <SelectValue>
                          {form.hasAds === 'true'
                            ? 'Sim'
                            : form.hasAds === 'false'
                              ? 'Não'
                              : 'Não sabemos'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">Não sabemos</SelectItem>
                        <SelectItem value="true">Sim</SelectItem>
                        <SelectItem value="false">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
                  {saving ? 'Salvando...' : 'Salvar ficha'}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <RegisterTouchDialog
        open={touchOpen}
        onOpenChange={setTouchOpen}
        prospect={prospect}
        onSuccess={() => {
          load();
          onChanged?.();
        }}
      />
      <ConvertProspectDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        prospect={prospect}
        onSuccess={() => {
          load();
          onChanged?.();
        }}
      />
    </>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
