'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Filter, Download, X, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
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

interface LeadRow {
  id: string;
  title: string;
  estimatedValue: number | null;
  temperature: 'COLD' | 'WARM' | 'HOT' | null;
  createdAt: string;
  pipeline: { id: string; name: string };
  status: { id: string; name: string; color: string; isWon: boolean; isFinal: boolean };
  assignee: { id: string; name: string } | null;
  contact: { name: string; phone: string | null; email: string | null } | null;
  company: { name: string } | null;
  tags: { tag: { id: string; name: string; color: string } }[];
  score: { score: number } | null;
}

interface Pipeline { id: string; name: string }
interface Member { id: string; name: string }

const TEMP_COLORS: Record<string, string> = {
  HOT: 'bg-red-100 text-red-700',
  WARM: 'bg-orange-100 text-orange-700',
  COLD: 'bg-blue-100 text-blue-700',
};

export default function AllLeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [filterPipeline, setFilterPipeline] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterTemp, setFilterTemp] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'won' | 'lost' | 'open'>('all');

  useEffect(() => {
    api.get('/pipelines').then((r) => setPipelines(r.data.data ?? [])).catch(() => {});
    api.get('/members').then((r) => setMembers(r.data.data ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterPipeline !== 'all') params.set('pipelineId', filterPipeline);
      if (filterAssignee !== 'all') params.set('assigneeId', filterAssignee);
      if (filterTemp !== 'all') params.set('temperature', filterTemp);
      if (filterStatus === 'won') params.set('isWon', 'true');
      if (filterStatus === 'lost') params.set('isLost', 'true');
      params.set('limit', '500');

      const res = await api.get(`/leads?${params}`);
      let list: LeadRow[] = res.data.data ?? [];
      if (filterStatus === 'open') {
        list = list.filter((l) => !l.status.isFinal);
      }
      setLeads(list);
    } catch (err: any) {
      if (err?.response?.status >= 500) {
        toast.error('Erro ao carregar leads');
      } else {
        console.warn('[/leads] falha não-fatal:', err?.message);
        setLeads([]);
      }
    } finally {
      setLoading(false);
    }
  }, [search, filterPipeline, filterAssignee, filterTemp, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    const total = leads.length;
    const won = leads.filter((l) => l.status.isWon).length;
    const lost = leads.filter((l) => l.status.isFinal && !l.status.isWon).length;
    const open = total - won - lost;
    const wonValue = leads
      .filter((l) => l.status.isWon)
      .reduce((s, l) => s + (l.estimatedValue ?? 0), 0);
    return { total, won, lost, open, wonValue };
  }, [leads]);

  const exportCsv = () => {
    if (leads.length === 0) return toast.error('Nada pra exportar');
    const headers = [
      'Título', 'Pipeline', 'Status', 'Contato', 'Telefone', 'Email',
      'Empresa', 'Responsável', 'Valor', 'Temperatura', 'Score', 'Tags', 'Criado em',
    ];
    const rows = leads.map((l) => [
      l.title,
      l.pipeline.name,
      l.status.name,
      l.contact?.name ?? '',
      l.contact?.phone ?? '',
      l.contact?.email ?? '',
      l.company?.name ?? '',
      l.assignee?.name ?? '',
      l.estimatedValue ?? '',
      l.temperature ?? '',
      l.score?.score ?? '',
      l.tags.map((t) => t.tag.name).join('; '),
      format(new Date(l.createdAt), 'dd/MM/yyyy HH:mm'),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveFilter =
    filterPipeline !== 'all' ||
    filterAssignee !== 'all' ||
    filterTemp !== 'all' ||
    filterStatus !== 'all' ||
    search;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Todos os leads</h1>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="mr-1 size-3.5" /> Exportar CSV
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SummaryCard label="Total" value={summary.total.toString()} />
        <SummaryCard label="Em aberto" value={summary.open.toString()} accent="blue" />
        <SummaryCard label="Ganhos" value={summary.won.toString()} accent="green" />
        <SummaryCard label="Perdidos" value={summary.lost.toString()} accent="red" />
        <SummaryCard
          label="Valor ganho"
          value={summary.wonValue.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            maximumFractionDigits: 0,
          })}
          accent="green"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, contato, email, telefone, empresa..."
            className="h-8 pl-7 text-sm"
          />
        </div>

        <Filter className="size-3.5 text-muted-foreground" />

        <Select value={filterPipeline} onValueChange={(v) => setFilterPipeline(v ?? 'all')}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos pipelines</SelectItem>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterAssignee} onValueChange={(v) => setFilterAssignee(v ?? 'all')}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos responsáveis</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterTemp} onValueChange={(v) => setFilterTemp(v ?? 'all')}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Temperatura</SelectItem>
            <SelectItem value="HOT">Hot</SelectItem>
            <SelectItem value="WARM">Warm</SelectItem>
            <SelectItem value="COLD">Cold</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterStatus}
          onValueChange={(v) => setFilterStatus((v ?? 'all') as typeof filterStatus)}
        >
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="open">Em aberto</SelectItem>
            <SelectItem value="won">Ganhos</SelectItem>
            <SelectItem value="lost">Perdidos</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => {
              setFilterPipeline('all');
              setFilterAssignee('all');
              setFilterTemp('all');
              setFilterStatus('all');
              setSearch('');
            }}
          >
            <X className="mr-1 size-3" /> Limpar
          </Button>
        )}
      </div>

      {/* Tabela */}
      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : leads.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-12 text-center text-sm text-muted-foreground">
          Nenhum lead encontrado com esses filtros.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Título</th>
                  <th className="px-3 py-2 text-left font-semibold">Pipeline</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Contato</th>
                  <th className="px-3 py-2 text-left font-semibold">Empresa</th>
                  <th className="px-3 py-2 text-left font-semibold">Responsável</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor</th>
                  <th className="px-3 py-2 text-center font-semibold">Temp.</th>
                  <th className="px-3 py-2 text-center font-semibold">Score</th>
                  <th className="px-3 py-2 text-left font-semibold">Criado</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b hover:bg-muted/30 last:border-b-0">
                    <td className="px-3 py-2">
                      <Link
                        href={`/pipelines/${l.pipeline.id}/board?leadId=${l.id}`}
                        className="font-medium hover:underline"
                      >
                        {l.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{l.pipeline.name}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        style={{ borderColor: l.status.color, color: l.status.color }}
                      >
                        {l.status.name}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {l.contact ? (
                        <div className="min-w-0">
                          <p className="truncate text-xs">{l.contact.name}</p>
                          {l.contact.phone && (
                            <p className="truncate text-[10px] text-muted-foreground">
                              {l.contact.phone}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {l.company?.name ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">{l.assignee?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {l.estimatedValue
                        ? l.estimatedValue.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            maximumFractionDigits: 0,
                          })
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {l.temperature && (
                        <span
                          className={cn(
                            'inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold',
                            TEMP_COLORS[l.temperature],
                          )}
                        >
                          {l.temperature}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      {l.score?.score ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {format(new Date(l.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            {leads.length} leads {leads.length >= 500 && '(mostrando primeiros 500 — refine os filtros)'}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'green' | 'red' | 'blue';
}) {
  const colors = {
    green: 'text-emerald-700',
    red: 'text-red-700',
    blue: 'text-blue-700',
  };
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-bold', accent && colors[accent])}>{value}</p>
    </div>
  );
}
