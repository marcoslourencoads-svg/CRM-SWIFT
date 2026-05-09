'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { LayoutGrid, List, Search, X, CheckSquare, Trash2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import type { Lead } from '@/components/kanban/lead-card';

interface Status {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface Pipeline {
  id: string;
  name: string;
  statuses: Status[];
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
}

const TEMPERATURE_OPTIONS = [
  { value: 'COLD', label: 'Frio' },
  { value: 'WARM', label: 'Morno' },
  { value: 'HOT', label: 'Quente' },
];

const DATE_RANGES = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
];

export default function BoardPage() {
  const params = useParams<{ pipelineId: string }>();
  const pipelineId = params.pipelineId;

  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [filterTemperature, setFilterTemperature] = useState<string>('');
  const [filterAssigneeId, setFilterAssigneeId] = useState<string>('');
  const [filterDateRange, setFilterDateRange] = useState<string>('');

  // Bulk selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMoveStatusId, setBulkMoveStatusId] = useState<string>('');

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (searchDebounced) params.set('search', searchDebounced);
    if (filterTagIds.length > 0) params.set('tagIds', filterTagIds.join(','));
    if (filterTemperature) params.set('temperature', filterTemperature);
    if (filterAssigneeId) params.set('assigneeId', filterAssigneeId);
    if (filterDateRange) {
      const days = parseInt(filterDateRange, 10);
      const after = new Date();
      after.setDate(after.getDate() - days);
      params.set('createdAfter', after.toISOString());
    }
    return params.toString();
  }, [searchDebounced, filterTagIds, filterTemperature, filterAssigneeId, filterDateRange]);

  const fetchData = useCallback(async () => {
    if (!pipelineId) return;
    try {
      const [pipelineRes, leadsRes] = await Promise.all([
        api.get(`/pipelines`),
        api.get(`/pipelines/${pipelineId}/leads${queryParams ? `?${queryParams}` : ''}`),
      ]);

      const found = (pipelineRes.data.data as Pipeline[]).find(
        (p) => p.id === pipelineId,
      );
      if (found) setPipeline(found);

      const enriched: Lead[] = (leadsRes.data.data as Lead[]).map((l) => ({
        ...l,
        pipelineId,
      }));
      setLeads(enriched);
    } catch (err) {
      console.error('Failed to fetch board data:', err);
    } finally {
      setLoading(false);
    }
  }, [pipelineId, queryParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load tags + members once
  useEffect(() => {
    api.get('/tags').then((res) => setTags(res.data.data ?? [])).catch(() => {});
    api.get('/memberships').then((res) => {
      const list = res.data.data ?? [];
      setMembers(
        list.map((m: { user: Member }) => m.user).filter((u: Member | undefined) => u !== undefined),
      );
    }).catch(() => {});
  }, []);

  const toggleTag = (tagId: string) => {
    setFilterTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const clearFilters = () => {
    setSearch('');
    setFilterTagIds([]);
    setFilterTemperature('');
    setFilterAssigneeId('');
    setFilterDateRange('');
  };

  const hasFilters =
    search.length > 0 ||
    filterTagIds.length > 0 ||
    !!filterTemperature ||
    !!filterAssigneeId ||
    !!filterDateRange;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-72" />
          ))}
        </div>
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="text-center text-muted-foreground">
        Pipeline nao encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{pipeline.name}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={selectionMode ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => {
              setSelectionMode((v) => !v);
              setSelectedIds(new Set());
            }}
          >
            <CheckSquare className="mr-1.5 size-4" />
            {selectionMode ? 'Cancelar seleção' : 'Selecionar'}
          </Button>
          <div className="flex items-center gap-1 rounded-lg border p-1">
            <Button variant="secondary" size="sm" disabled>
              <LayoutGrid className="mr-1.5 size-4" />
              Board
            </Button>
            <Link
              href={`/pipelines/${pipelineId}/list`}
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              <List className="mr-1.5 size-4" />
              Lista
            </Link>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, contato ou empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select
          value={filterTemperature}
          onValueChange={(val) => setFilterTemperature(val ?? '')}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Temperatura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            {TEMPERATURE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterAssigneeId}
          onValueChange={(val) => setFilterAssigneeId(val ?? '')}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos responsáveis</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterDateRange}
          onValueChange={(val) => setFilterDateRange(val ?? '')}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Sempre</SelectItem>
            {DATE_RANGES.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 size-3" />
            Limpar
          </Button>
        )}
      </div>

      {/* Tag filter chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Tags:</span>
          {tags.map((tag) => {
            const active = filterTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className="transition-opacity"
              >
                <Badge
                  variant="outline"
                  style={{
                    borderColor: tag.color,
                    color: active ? '#fff' : tag.color,
                    backgroundColor: active ? tag.color : 'transparent',
                  }}
                  className="cursor-pointer"
                >
                  {tag.name}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      <KanbanBoard
        pipelineId={pipelineId}
        statuses={pipeline.statuses}
        initialLeads={leads}
        onRefresh={fetchData}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onToggleSelected={toggleSelected}
      />

      {/* Bulk action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-2xl">
          <span className="text-sm font-medium">
            {selectedIds.size} {selectedIds.size === 1 ? 'lead selecionado' : 'leads selecionados'}
          </span>

          <div className="flex items-center gap-1 border-l pl-3">
            <Select
              value={bulkMoveStatusId}
              onValueChange={(val) => setBulkMoveStatusId(val ?? '')}
            >
              <SelectTrigger className="w-44 h-8">
                <SelectValue placeholder="Mover para..." />
              </SelectTrigger>
              <SelectContent>
                {pipeline.statuses.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!bulkMoveStatusId}
              onClick={async () => {
                try {
                  await api.patch('/leads/bulk/move', {
                    leadIds: Array.from(selectedIds),
                    statusId: bulkMoveStatusId,
                  });
                  toast.success(`${selectedIds.size} leads movidos`);
                  setSelectedIds(new Set());
                  setBulkMoveStatusId('');
                  fetchData();
                } catch {
                  toast.error('Erro ao mover leads');
                }
              }}
            >
              <ArrowRight className="size-3" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (!confirm(`Excluir ${selectedIds.size} leads selecionados?`)) return;
              try {
                await api.patch('/leads/bulk/delete', {
                  leadIds: Array.from(selectedIds),
                });
                toast.success(`${selectedIds.size} leads excluídos`);
                setSelectedIds(new Set());
                fetchData();
              } catch {
                toast.error('Erro ao excluir leads');
              }
            }}
            className="border-l pl-3 text-red-600 hover:text-red-700"
          >
            <Trash2 className="mr-1 size-3" />
            Excluir
          </Button>
        </div>
      )}
    </div>
  );
}
