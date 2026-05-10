'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';

type Channel = 'TELEGRAM' | 'EVOLUTION_WA' | 'ZAPI_WA' | 'MANUAL';

interface MetaAccount {
  id: string;
  clientName: string;
  adAccountId: string;
  reportChannel: Channel;
  reportTarget: string;
  scheduleCron: string;
  active: boolean;
  lastRunAt: string | null;
  lastError: string | null;
}

const CHANNEL_LABEL: Record<Channel, string> = {
  TELEGRAM: 'Telegram',
  EVOLUTION_WA: 'Evolution WA (Fase 2)',
  ZAPI_WA: 'Z-API WhatsApp (Fase 2)',
  MANUAL: 'Manual (só salva)',
};

export default function MetaAdsPage() {
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    clientName: '',
    adAccountId: '',
    accessToken: '',
    reportChannel: 'TELEGRAM' as Channel,
    reportTarget: '',
    scheduleCron: '0 8 * * *',
  });

  async function fetchData() {
    setLoading(true);
    try {
      const { data } = await api.get('/meta-ads/accounts');
      setAccounts(data.data ?? data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao carregar contas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleSave() {
    if (!form.clientName || !form.adAccountId || !form.accessToken || !form.reportTarget) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSaving(true);
    try {
      await api.post('/meta-ads/accounts', form);
      toast.success(`${form.clientName} cadastrado`);
      setDialogOpen(false);
      setForm({
        clientName: '',
        adAccountId: '',
        accessToken: '',
        reportChannel: 'TELEGRAM',
        reportTarget: '',
        scheduleCron: '0 8 * * *',
      });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao cadastrar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Meta Ads — Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conecte contas de anúncios e dispare relatórios automáticos para clientes
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova conta
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Conectar conta de Meta Ads</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome do cliente</Label>
                <Input
                  placeholder="Burger do Zé"
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>ID da conta de anúncios (act_…)</Label>
                <Input
                  placeholder="act_1234567890"
                  value={form.adAccountId}
                  onChange={(e) => setForm({ ...form, adAccountId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Access token (Marketing API)</Label>
                <Input
                  type="password"
                  placeholder="EAAB..."
                  value={form.accessToken}
                  onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Use System User token (longa duração) gerado no Business Manager
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Canal de envio</Label>
                  <Select
                    value={form.reportChannel}
                    onValueChange={(v) => v && setForm({ ...form, reportChannel: v as Channel })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TELEGRAM">Telegram</SelectItem>
                      <SelectItem value="MANUAL">Manual</SelectItem>
                      <SelectItem value="EVOLUTION_WA" disabled>Evolution WA (Fase 2)</SelectItem>
                      <SelectItem value="ZAPI_WA" disabled>Z-API (Fase 2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cron (8h padrão)</Label>
                  <Input
                    placeholder="0 8 * * *"
                    value={form.scheduleCron}
                    onChange={(e) => setForm({ ...form, scheduleCron: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  {form.reportChannel === 'TELEGRAM' ? 'chat_id do Telegram' : 'Número WhatsApp destino'}
                </Label>
                <Input
                  placeholder={form.reportChannel === 'TELEGRAM' ? '123456789' : '5521999999999'}
                  value={form.reportTarget}
                  onChange={(e) => setForm({ ...form, reportTarget: e.target.value })}
                />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cadastrar conta
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground mb-3">
            Nenhuma conta Meta cadastrada ainda
          </p>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar a primeira
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left font-medium px-4 py-2">Cliente</th>
                <th className="text-left font-medium px-4 py-2">Conta Meta</th>
                <th className="text-left font-medium px-4 py-2">Canal</th>
                <th className="text-left font-medium px-4 py-2">Cron</th>
                <th className="text-left font-medium px-4 py-2">Última execução</th>
                <th className="text-right font-medium px-4 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="px-4 py-2 font-medium">{a.clientName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{a.adAccountId}</td>
                  <td className="px-4 py-2">
                    <Badge variant="secondary" className="text-xs">
                      {CHANNEL_LABEL[a.reportChannel]}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{a.scheduleCron}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {a.lastRunAt ? (
                      new Date(a.lastRunAt).toLocaleString('pt-BR')
                    ) : (
                      <span className="italic">nunca</span>
                    )}
                    {a.lastError && (
                      <div className="text-amber-600 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        <span className="truncate max-w-[200px]" title={a.lastError}>
                          {a.lastError}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/meta-ads/${a.id}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Abrir
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
