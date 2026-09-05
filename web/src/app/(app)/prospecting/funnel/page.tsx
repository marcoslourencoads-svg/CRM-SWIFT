'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BarChart3, Info, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { BarChart } from '@/components/ui/bar-chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  CHANNEL_META,
  formatPct,
  type ProspectChannel,
  type ProspectList,
} from '@/lib/prospecting';

interface Step {
  key: string;
  label: string;
  count: number;
  pctFromPrev: number;
  pctFromTop: number;
}

interface CutRow {
  chave: string;
  label: string;
  abordados: number;
  respostas: number;
  reunioesAgendadas: number;
  reunioesFeitas: number;
  fechamentos: number;
  receita: number;
  taxaResposta: number;
  taxaFechamento: number;
  amostraSuficiente: boolean;
}

interface TouchRow {
  sequence: number;
  label: string;
  enviados: number;
  respostas: number;
  taxaResposta: number;
  amostraSuficiente: boolean;
}

interface Analytics {
  amostra: number;
  amostraSuficiente: boolean;
  etapas: Step[];
  metricas: {
    totalContratos: number;
    ticketMedio: number;
    fechamentos: number;
    cicloMedioDias: number;
    tempoMedioAteRespostaHoras: number;
    noShowRate: number;
    toquesMedioAteResposta: number;
    toquesMedios: number;
  };
  porToque: TouchRow[];
  cortes: {
    porAbordagem: CutRow[];
    porResponsavel: CutRow[];
    porNicho: CutRow[];
    porAnuncio: CutRow[];
    porCanal: CutRow[];
    porLista: CutRow[];
  };
  motivosPerda: { id: string; nome: string; count: number; pct: number }[];
}

type Periodo = 'all' | '30d' | '90d' | 'year' | 'custom';

// Este Select nao resolve o rotulo do item sozinho: sem children ele
// mostra o valor cru ("all"). Todas as telas do CRM passam o texto.
const PERIODO_LABEL: Record<Periodo, string> = {
  all: 'Todo o histórico',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  year: 'Último ano',
  custom: 'Personalizado',
};

function rangeFor(periodo: Periodo): { from?: string; to?: string } {
  if (periodo === 'all' || periodo === 'custom') return {};
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const days = periodo === '30d' ? 30 : periodo === '90d' ? 90 : 365;
  const from = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

/**
 * Funil de prospecção ativa, por COORTE.
 *
 * A coorte é quem foi abordado dentro do período; cada degrau conta
 * quem algum dia atingiu aquele carimbo. A aba "Funil" da planilha
 * dividia tudo pelo total de abordagens, misturando quem foi abordado
 * ontem com quem foi abordado há um mês.
 */
export default function ProspectingFunnelPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [lists, setLists] = useState<ProspectList[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [listId, setListId] = useState('all');
  const [channel, setChannel] = useState('all');
  const [hasAds, setHasAds] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const range = periodo === 'custom' ? { from: customFrom, to: customTo } : rangeFor(periodo);
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      if (listId !== 'all') params.set('listId', listId);
      if (channel !== 'all') params.set('channel', channel);
      if (hasAds !== 'all') params.set('hasAds', hasAds);

      const res = await api.get(`/prospecting/analytics?${params}`);
      setData(res.data.data);
    } catch {
      toast.error('Não foi possível carregar o funil');
    } finally {
      setLoading(false);
    }
  }, [periodo, customFrom, customTo, listId, channel, hasAds]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .get('/prospect-lists')
      .then((res) => setLists(res.data.data ?? []))
      .catch(() => {});
  }, []);

  const touchChartData = useMemo(
    () =>
      (data?.porToque ?? []).map((t) => ({
        toque: t.label,
        'Taxa de resposta': t.taxaResposta,
      })),
    [data],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={TrendingUp}
        title="Funil de prospecção"
        description="Coorte por data da abordagem — não por etapa atual"
        count={data ? `${data.amostra} abordados` : undefined}
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Período</Label>
          <Select value={periodo} onValueChange={(v) => setPeriodo((v ?? 'all') as Periodo)}>
            <SelectTrigger className="w-40">
              <SelectValue>{PERIODO_LABEL[periodo]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo o histórico</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="year">Último ano</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {periodo === 'custom' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">De</Label>
              <Input
                type="date"
                className="w-40"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Até</Label>
              <Input
                type="date"
                className="w-40"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Lista</Label>
          <Select value={listId} onValueChange={(v) => setListId(v ?? 'all')}>
            <SelectTrigger className="w-44">
              <SelectValue>
                {listId === 'all'
                  ? 'Todas as listas'
                  : (lists.find((l) => l.id === listId)?.name ?? 'Lista')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as listas</SelectItem>
              {lists.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Canal</Label>
          <Select value={channel} onValueChange={(v) => setChannel(v ?? 'all')}>
            <SelectTrigger className="w-36">
              <SelectValue>
                {channel === 'all'
                  ? 'Todos'
                  : CHANNEL_META[channel as ProspectChannel].label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(CHANNEL_META).map(([key, meta]) => (
                <SelectItem key={key} value={key}>
                  {meta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Tem anúncio</Label>
          <Select value={hasAds} onValueChange={(v) => setHasAds(v ?? 'all')}>
            <SelectTrigger className="w-32">
              <SelectValue>
                {hasAds === 'all' ? 'Todos' : hasAds === 'true' ? 'Anuncia' : 'Não anuncia'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Anuncia</SelectItem>
              <SelectItem value="false">Não anuncia</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : !data || data.amostra === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Nada abordado neste recorte"
          description="O funil conta a coorte de quem foi abordado no período. Registre toques ou amplie o período para ver os números."
        />
      ) : (
        <div className="space-y-6">
          {!data.amostraSuficiente && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <Info className="mt-0.5 size-4 shrink-0" />
              <p>
                <strong>Amostra pequena ({data.amostra} abordados).</strong> Abaixo de
                30, as taxas oscilam demais para embasar decisão — uma resposta a mais
                ou a menos muda tudo. Trate os números como indicativos até o volume
                crescer.
              </p>
            </div>
          )}

          {/* Degraus */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Funil</CardTitle>
              <p className="text-xs text-muted-foreground">
                Cada degrau conta quem algum dia chegou lá. A primeira porcentagem é
                sobre a etapa anterior (onde você perde gente); a segunda é sobre o
                topo (quanto sobra no fim).
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.etapas.map((step, i) => (
                <FunnelStep
                  key={step.key}
                  step={step}
                  first={i === 0}
                  max={data.etapas[0].count || 1}
                />
              ))}
            </CardContent>
          </Card>

          {/* Métricas */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Total em contratos"
              value={formatCurrency(data.metricas.totalContratos)}
            />
            <Metric label="Ticket médio" value={formatCurrency(data.metricas.ticketMedio)} />
            <Metric
              label="Ciclo médio"
              value={
                data.metricas.cicloMedioDias
                  ? `${data.metricas.cicloMedioDias.toFixed(1).replace('.', ',')} dias`
                  : '—'
              }
              hint="Da abordagem ao contrato"
            />
            <Metric
              label="Tempo até resposta"
              value={
                data.metricas.tempoMedioAteRespostaHoras
                  ? `${data.metricas.tempoMedioAteRespostaHoras.toFixed(1).replace('.', ',')} h`
                  : '—'
              }
            />
            <Metric
              label="No-show"
              value={formatPct(data.metricas.noShowRate)}
              hint="Agendaram e não apareceram"
            />
            <Metric
              label="Toques até responder"
              value={
                data.metricas.toquesMedioAteResposta
                  ? data.metricas.toquesMedioAteResposta.toFixed(1).replace('.', ',')
                  : '—'
              }
            />
            <Metric
              label="Toques por prospect"
              value={data.metricas.toquesMedios.toFixed(1).replace('.', ',')}
            />
            <Metric label="Fechamentos" value={String(data.metricas.fechamentos)} />
          </div>

          {/* A métrica-âncora */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Taxa de resposta por toque</CardTitle>
              <p className="text-xs text-muted-foreground">
                O número que decide se cada follow-up paga o esforço. Se a barra do FUP
                2 for tão alta quanto a da abordagem, parar no primeiro toque está
                jogando metade das respostas fora.
              </p>
            </CardHeader>
            <CardContent>
              {touchChartData.length > 0 ? (
                <>
                  <BarChart
                    className="h-56"
                    data={touchChartData}
                    index="toque"
                    categories={['Taxa de resposta']}
                    colors={['blue']}
                    valueFormatter={(v) => formatPct(v)}
                    showLegend={false}
                  />
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-1.5 text-left font-medium">Toque</th>
                          <th className="py-1.5 text-right font-medium">Enviados</th>
                          <th className="py-1.5 text-right font-medium">Respostas</th>
                          <th className="py-1.5 text-right font-medium">Taxa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.porToque.map((t) => (
                          <tr key={t.sequence} className="border-b last:border-0">
                            <td className="py-1.5 font-medium">{t.label}</td>
                            <td className="py-1.5 text-right tabular-nums">{t.enviados}</td>
                            <td className="py-1.5 text-right tabular-nums">{t.respostas}</td>
                            <td className="py-1.5 text-right tabular-nums">
                              {formatPct(t.taxaResposta)}
                              {!t.amostraSuficiente && (
                                <span className="ml-1 text-[10px] text-amber-600">n baixo</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum toque registrado neste recorte.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Cortes */}
          <div className="grid gap-4 lg:grid-cols-2">
            <CutTable
              title="Por abordagem (script)"
              hint="Qual mensagem converte. A planilha coletava esse campo e nunca cruzava."
              rows={data.cortes.porAbordagem}
            />
            <CutTable
              title="Tem anúncio?"
              hint="Se quem anuncia responde mais, o qualificador vira critério de lista."
              rows={data.cortes.porAnuncio}
            />
            <CutTable title="Por responsável" hint="Comparação entre SDRs." rows={data.cortes.porResponsavel} />
            <CutTable title="Por nicho" hint="Qual segmento vale a insistência." rows={data.cortes.porNicho} />
            <CutTable title="Por canal" hint="Instagram, WhatsApp, e-mail ou ligação." rows={data.cortes.porCanal} />
            <CutTable title="Por lista" hint="Comparação entre campanhas." rows={data.cortes.porLista} />
          </div>

          {/* Motivos de perda */}
          {data.motivosPerda.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Motivos de perda</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Agregado pelo catálogo da organização, não por texto livre.
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {data.motivosPerda.map((m) => (
                    <li key={m.id} className="flex items-center justify-between text-sm">
                      <span>{m.nome}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {m.count} · {formatPct(m.pct)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function FunnelStep({ step, first, max }: { step: Step; first: boolean; max: number }) {
  const width = max ? Math.max((step.count / max) * 100, step.count > 0 ? 4 : 0) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{step.label}</span>
        <span className="flex items-baseline gap-2 tabular-nums">
          <span className="font-semibold">{step.count}</span>
          {!first && (
            <span className="text-xs text-muted-foreground">
              {formatPct(step.pctFromPrev)} da anterior · {formatPct(step.pctFromTop)} do topo
            </span>
          )}
        </span>
      </div>
      <div className="h-6 overflow-hidden rounded-md bg-muted">
        <div
          className="h-full rounded-md bg-blue-500 transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function CutTable({ title, hint, rows }: { title: string; hint: string; rows: CutRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Sem dados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="py-1.5 text-left font-medium">&nbsp;</th>
                  <th className="py-1.5 text-right font-medium">Abord.</th>
                  <th className="py-1.5 text-right font-medium">Resp.</th>
                  <th className="py-1.5 text-right font-medium">Reun.</th>
                  <th className="py-1.5 text-right font-medium">Fech.</th>
                  <th className="py-1.5 text-right font-medium">Taxa resp.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.chave} className="border-b last:border-0">
                    <td className="max-w-[140px] truncate py-1.5 font-medium" title={r.label}>
                      {r.label}
                      {!r.amostraSuficiente && (
                        <span
                          className="ml-1 text-[10px] font-normal text-amber-600"
                          title="Menos de 30 abordados: taxa instável"
                        >
                          n baixo
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{r.abordados}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.respostas}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.reunioesFeitas}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.fechamentos}</td>
                    <td
                      className={cn(
                        'py-1.5 text-right font-medium tabular-nums',
                        !r.amostraSuficiente && 'text-muted-foreground',
                      )}
                    >
                      {formatPct(r.taxaResposta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
