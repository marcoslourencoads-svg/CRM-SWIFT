'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { CHANNEL_META, type ProspectChannel, type ProspectList } from '@/lib/prospecting';

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
};

/**
 * Captura rápida.
 *
 * Só o nome é obrigatório — prospecção acontece em rajada, e um
 * formulário longo faz o operador voltar para o bloco de notas. O resto
 * se completa depois, na ficha.
 */
export function NewProspectForm({ lists, defaultListId, onCreated, onCancel }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [channel, setChannel] = useState<ProspectChannel>('INSTAGRAM');
  const [listId, setListId] = useState(defaultListId ?? lists[0]?.id ?? 'none');
  const [nextActionAt, setNextActionAt] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  function set(key: keyof typeof EMPTY, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error('O nome é obrigatório');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/prospects', {
        name: form.name.trim(),
        ...(form.business.trim() ? { business: form.business.trim() } : {}),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.handle.trim() ? { handle: form.handle.trim() } : {}),
        ...(form.niche.trim() ? { niche: form.niche.trim() } : {}),
        channel,
        ...(listId !== 'none' ? { listId } : {}),
        ...(nextActionAt ? { nextActionAt: new Date(nextActionAt).toISOString() } : {}),
      });
      toast.success('Prospect adicionado');
      setForm(EMPTY);
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
        Só o nome já basta pra começar. O resto você completa depois, na ficha.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="np-name" className="text-xs">
            Nome do contato
          </Label>
          <Input
            id="np-name"
            autoFocus
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
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
          <Label className="text-xs">Canal do primeiro toque</Label>
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
          <Label htmlFor="np-next" className="text-xs">
            Próxima ação
          </Label>
          <Input
            id="np-next"
            type="date"
            value={nextActionAt}
            onChange={(e) => setNextActionAt(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Adicionando...' : 'Adicionar prospect'}
        </Button>
      </div>
    </div>
  );
}
