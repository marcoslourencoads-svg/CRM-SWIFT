'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  Send,
  ChevronLeft,
  Copy,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';

type DatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week_mon_today'
  | 'last_7d'
  | 'last_14d'
  | 'last_30d';

interface Account {
  id: string;
  clientName: string;
  adAccountId: string;
  reportChannel: string;
  reportTarget: string;
  scheduleCron: string;
  lastRunAt: string | null;
  lastError: string | null;
}

interface Report {
  id: string;
  rawText: string;
  totalSpend: number;
  periodStart: string;
  periodEnd: string;
  sentAt: string | null;
  sentChannel: string | null;
  sendError: string | null;
  createdAt: string;
}

const PRESET_LABEL: Record<DatePreset, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  this_week_mon_today: 'Esta semana',
  last_7d: 'Últimos 7 dias',
  last_14d: 'Últimos 14 dias',
  last_30d: 'Últimos 30 dias',
};

export default function MetaAccountDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [account, setAccount] = useState<Account | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>('yesterday');
  const [sendOnGenerate, setSendOnGenerate] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [accRes, repRes] = await Promise.all([
        api.get(`/meta-ads/accounts/${id}`),
        api.get(`/meta-ads/accounts/${id}/reports?limit=20`),
      ]);
      setAccount(accRes.data.data ?? accRes.data);
      setReports(repRes.data.data ?? repRes.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao carregar conta');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { data } = await api.post(
        `/meta-ads/accounts/${id}/generate?send=${sendOnGenerate}`,
        { datePreset },
      );
      const result = data.data ?? data;
      toast.success(
        sendOnGenerate
          ? result.send?.ok
            ? 'Relatório gerado e enviado'
            : `Gerado, mas envio falhou: ${result.send?.error ?? '—'}`
          : 'Relatório gerado (sem enviar)',
      );
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao gerar relatório');
    } finally {
      setGenerating(false);
    }
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Texto copiado pra área de transferência');
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Conta não encontrada.{' '}
        <Link href="/meta-ads" className="text-primary hover:underline">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/meta-ads"
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-3 w-3" />
          Voltar
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{account.clientName}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {account.adAccountId} · cron <code className="text-xs">{account.scheduleCron}</code> · canal{' '}
              <Badge variant="secondary" className="text-xs">{account.reportChannel}</Badge>
            </p>
          </div>
        </div>
        {account.lastError && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <strong>Última execução com erro:</strong> {account.lastError}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border p-4 bg-card">
        <h2 className="text-sm font-medium mb-3">Gerar relatório agora</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Período</label>
            <Select value={datePreset} onValueChange={(v) => v && setDatePreset(v as DatePreset)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRESET_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={sendOnGenerate}
              onChange={(e) => setSendOnGenerate(e.target.checked)}
            />
            Enviar pro {account.reportChannel.toLowerCase()}
          </label>
          <Button onClick={handleGenerate} disabled={generating} size="sm">
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Gerar agora
          </Button>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium mb-3">Histórico (últimos {reports.length})</h2>
        {reports.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum relatório gerado ainda
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="rounded-lg border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-muted/30 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      {new Date(r.createdAt).toLocaleString('pt-BR')}
                    </span>
                    <span className="text-muted-foreground">
                      Investido: R$ {(r.totalSpend / 100).toFixed(2)}
                    </span>
                    {r.sentAt && (
                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Enviado via {r.sentChannel}
                      </Badge>
                    )}
                    {r.sendError && (
                      <Badge variant="destructive" className="text-xs">
                        Falha: {r.sendError}
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyText(r.rawText)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar texto
                  </Button>
                </div>
                <pre className="px-4 py-3 text-xs whitespace-pre-wrap font-mono bg-background">
                  {r.rawText}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
