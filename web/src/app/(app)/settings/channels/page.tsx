'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Channel {
  id: string;
  type: 'WHATSAPP' | 'INSTAGRAM' | 'EMAIL';
  provider: 'MANUAL' | 'EVOLUTION' | 'ZAPI' | 'META_CLOUD';
  name: string;
  isActive: boolean;
  createdAt: string;
}

const PROVIDER_LABELS: Record<Channel['provider'], string> = {
  MANUAL: 'Manual (registra local)',
  EVOLUTION: 'Evolution API (em breve)',
  ZAPI: 'Z-API (em breve)',
  META_CLOUD: 'Meta Cloud / WhatsApp Business (em breve)',
};

const PROVIDER_AVAILABLE: Record<Channel['provider'], boolean> = {
  MANUAL: true,
  EVOLUTION: false,
  ZAPI: false,
  META_CLOUD: false,
};

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('WhatsApp principal');
  const [newProvider, setNewProvider] = useState<Channel['provider']>('MANUAL');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/inbox/channels');
      setChannels(res.data.data ?? []);
    } catch {
      toast.error('Erro ao carregar canais');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createChannel = async () => {
    if (!newName.trim()) return toast.error('Informe o nome');
    setCreating(true);
    try {
      await api.post('/inbox/channels', {
        type: 'WHATSAPP',
        provider: newProvider,
        name: newName.trim(),
      });
      toast.success('Canal criado');
      setNewName('WhatsApp principal');
      load();
    } catch {
      toast.error('Erro ao criar canal');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (c: Channel) => {
    try {
      await api.patch(`/inbox/channels/${c.id}`, { isActive: !c.isActive });
      load();
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const remove = async (c: Channel) => {
    if (!confirm(`Apagar canal "${c.name}"? Conversas vinculadas também serão removidas.`)) return;
    try {
      await api.delete(`/inbox/channels/${c.id}`);
      toast.success('Canal removido');
      load();
    } catch {
      toast.error('Erro ao remover');
    }
  };

  return (
    <div className="max-w-3xl">
      <h2 className="mb-1 text-lg font-semibold">Canais de inbox</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Conecte WhatsApp, Instagram e Email pra centralizar conversas no CRM.
        Hoje só o modo <strong>manual</strong> tá ativo — os outros providers ficam pra v2.
      </p>

      {/* Lista de canais */}
      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="space-y-2">
          {channels.length === 0 ? (
            <div className="rounded-lg border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              Nenhum canal configurado. Crie o primeiro abaixo.
            </div>
          ) : (
            channels.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{c.name}</p>
                    <Badge variant={c.isActive ? 'default' : 'secondary'}>
                      {c.isActive ? 'Ativo' : 'Pausado'}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {c.type}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {PROVIDER_LABELS[c.provider]}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(c)}>
                    {c.isActive ? 'Pausar' : 'Ativar'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(c)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Form de criação */}
      <div className="mt-6 rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Adicionar canal</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="WhatsApp principal"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Provider</Label>
            <Select
              value={newProvider}
              onValueChange={(v) => setNewProvider((v ?? 'MANUAL') as Channel['provider'])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PROVIDER_LABELS) as Channel['provider'][]).map((p) => (
                  <SelectItem key={p} value={p} disabled={!PROVIDER_AVAILABLE[p]}>
                    {PROVIDER_LABELS[p]}
                    {PROVIDER_AVAILABLE[p] && (
                      <Check className="ml-2 inline size-3 text-emerald-600" />
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <AlertCircle className="size-3" />
            Tipo WhatsApp por padrão. Outros tipos viram com providers reais.
          </p>
          <Button onClick={createChannel} disabled={creating} size="sm">
            <Plus className="mr-1 size-3" /> {creating ? 'Criando...' : 'Adicionar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
