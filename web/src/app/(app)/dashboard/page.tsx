'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarChart } from '@/components/ui/bar-chart';
import { BarList } from '@/components/ui/bar-list';

/* ---------- types ---------- */

interface Pipeline {
  id: string;
  name: string;
}

interface RevenueByStatus {
  statusName: string;
  color: string;
  count: number;
  totalValue: number;
}

interface KpiData {
  leadsToday: number;
  leadsMonth: number;
  mqls: number;
  disqualified: number;
  meetingsScheduled: number;
  sales: number;
  salesRevenue: number;
  revenueByStatus: RevenueByStatus[];
  conversionMeetingToClose: number;
  conversionFullFunnel: number;
}

interface CplData {
  totalInvestment: number;
  leadCount: number;
  cpl: number;
}

interface FunnelStep {
  statusName: string;
  color: string;
  count: number;
  conversionFromPrev: number;
}

/* ---------- period helpers ---------- */

type Period = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year';

const PERIOD_LABELS: Record<Period, string> = {
  all: 'Todos',
  today: 'Hoje',
  week: 'Semana',
  month: 'Mes',
  quarter: 'Trimestre',
  year: 'Ano',
};

function getDateRange(period: Period): { dateFrom?: string; dateTo?: string } {
  if (period === 'all') return {};

  const now = new Date();
  const dateTo = now.toISOString().slice(0, 10);
  let dateFrom: string;

  switch (period) {
    case 'today':
      dateFrom = dateTo;
      break;
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      dateFrom = d.toISOString().slice(0, 10);
      break;
    }
    case 'month': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFrom = d.toISOString().slice(0, 10);
      break;
    }
    case 'quarter': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      dateFrom = d.toISOString().slice(0, 10);
      break;
    }
    case 'year': {
      dateFrom = `${now.getFullYear()}-01-01`;
      break;
    }
  }

  return { dateFrom, dateTo };
}

/* ---------- component ---------- */

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');
  const [period, setPeriod] = useState<Period>('all');

  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [cpl, setCpl] = useState<CplData | null>(null);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);

  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingCpl, setLoadingCpl] = useState(true);
  const [loadingFunnel, setLoadingFunnel] = useState(true);

  // Load pipelines on mount
  useEffect(() => {
    api.get('/pipelines').then(({ data }) => {
      const list: Pipeline[] = data.data ?? data;
      setPipelines(list);
      if (list.length > 0) setSelectedPipeline(list[0].id);
    });
  }, []);

  // Fetch KPIs
  const fetchKpis = useCallback(async () => {
    if (!selectedPipeline) return;
    setLoadingKpis(true);
    try {
      const { dateFrom, dateTo } = getDateRange(period);
      const { data } = await api.get('/dashboard/kpis', {
        params: { pipelineId: selectedPipeline, dateFrom, dateTo },
      });
      setKpis(data.data);
    } catch {
      /* silently ignore */
    } finally {
      setLoadingKpis(false);
    }
  }, [selectedPipeline, period]);

  // Fetch CPL
  const fetchCpl = useCallback(async () => {
    setLoadingCpl(true);
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const { data } = await api.get('/dashboard/cpl', {
        params: { month },
      });
      setCpl(data.data);
    } catch {
      /* silently ignore */
    } finally {
      setLoadingCpl(false);
    }
  }, []);

  // Fetch funnel
  const fetchFunnel = useCallback(async () => {
    if (!selectedPipeline) return;
    setLoadingFunnel(true);
    try {
      const { data } = await api.get(`/dashboard/funnel/${selectedPipeline}`);
      setFunnel(data.data.steps ?? []);
    } catch {
      /* silently ignore */
    } finally {
      setLoadingFunnel(false);
    }
  }, [selectedPipeline]);

  useEffect(() => {
    fetchKpis();
    fetchCpl();
  }, [fetchKpis, fetchCpl]);

  useEffect(() => {
    fetchFunnel();
  }, [fetchFunnel]);

  /* ---------- render ---------- */

  const kpiCards: { label: string; value: string }[] = kpis
    ? [
        { label: 'Leads hoje', value: String(kpis.leadsToday) },
        { label: 'Leads do mes', value: String(kpis.leadsMonth) },
        { label: 'MQL', value: String(kpis.mqls) },
        { label: 'Vendas', value: String(kpis.sales) },
        {
          label: 'CPL',
          value: cpl ? formatCurrency(cpl.cpl) : '--',
        },
        {
          label: 'Conversao',
          value: `${kpis.conversionFullFunnel.toFixed(1)}%`,
        },
      ]
    : [];

  // Transform revenue data for Tremor BarChart
  const revenueChartData = kpis?.revenueByStatus.map((r) => ({
    statusName: r.statusName,
    Receita: r.totalValue,
  })) ?? [];

  // Transform funnel data for Tremor BarList
  const funnelBarListData = funnel.map((step) => ({
    name: step.statusName,
    value: step.count,
    color: step.color,
    conversionFromPrev: step.conversionFromPrev,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Bem-vindo, {user?.email}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Pipeline selector */}
          <Select
            value={selectedPipeline}
            onValueChange={(v) => setSelectedPipeline(v as string)}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Period filter */}
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as Period)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABELS) as Period[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {PERIOD_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {loadingKpis
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          : kpiCards.map((kpi) => (
              <Card key={kpi.label}>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-bold">{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by Status - Tremor BarChart */}
        <Card>
          <CardContent>
            <h2 className="mb-4 text-base font-semibold">
              Receita por Status
            </h2>
            {loadingKpis ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : revenueChartData.length > 0 ? (
              <BarChart
                className="h-72"
                data={revenueChartData}
                index="statusName"
                categories={['Receita']}
                colors={['blue']}
                valueFormatter={(v) => formatCurrency(v)}
                layout="vertical"
                showLegend={false}
                yAxisWidth={120}
              />
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                Sem dados de receita para o periodo.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Funnel - Tremor BarList */}
        <Card>
          <CardContent>
            <h2 className="mb-4 text-base font-semibold">
              Funil de Conversao
            </h2>
            {loadingFunnel ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : funnelBarListData.length > 0 ? (
              <div className="space-y-1">
                {funnel.map((step, idx) => {
                  const maxCount = Math.max(...funnel.map((s) => s.count), 1);
                  const widthPct = Math.max(
                    (step.count / maxCount) * 100,
                    8,
                  );

                  return (
                    <div key={step.statusName}>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 items-center justify-between rounded px-3 text-sm font-medium text-white"
                          style={{
                            width: `${widthPct}%`,
                            backgroundColor: step.color || '#6366f1',
                            minWidth: 'fit-content',
                          }}
                        >
                          <span className="truncate">{step.statusName}</span>
                          <span className="ml-2 shrink-0">{step.count}</span>
                        </div>
                      </div>

                      {idx < funnel.length - 1 && (
                        <div className="py-0.5 pl-4 text-xs text-muted-foreground">
                          {(step.conversionFromPrev ?? 0).toFixed(1)}% &darr;
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                Sem dados de funil.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
