'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { Download, Kanban, Plus, Search, Upload } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { ProspectCard } from '@/components/prospecting/prospect-card';
import { ProspectDrawer } from '@/components/prospecting/prospect-drawer';
import { NewProspectForm } from '@/components/prospecting/new-prospect-form';
import {
  BOARD_STAGES,
  CHANNEL_META,
  STAGE_META,
  type Prospect,
  type ProspectChannel,
  type ProspectList,
  type ProspectStage,
} from '@/lib/prospecting';

/**
 * Quadro da prospecção: uma coluna por etapa.
 *
 * Só é possível porque a etapa virou UM campo. Na planilha ela era
 * inferida de onze booleanos independentes, que podiam se contradizer.
 */
export default function ProspectingBoardPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [lists, setLists] = useState<ProspectList[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [listId, setListId] = useState('all');
  const [channel, setChannel] = useState('all');
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debounced) params.set('search', debounced);
      if (listId !== 'all') params.set('listId', listId);
      if (channel !== 'all') params.set('channel', channel);
      params.set('limit', '500');

      const [prospectsRes, listsRes] = await Promise.all([
        api.get(`/prospects?${params}`),
        api.get('/prospect-lists'),
      ]);
      setProspects(prospectsRes.data.data ?? []);
      setLists(listsRes.data.data ?? []);
    } catch {
      toast.error('Não foi possível carregar o quadro');
    } finally {
      setLoading(false);
    }
  }, [debounced, listId, channel]);

  useEffect(() => {
    load();
  }, [load]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const byStage = useMemo(() => {
    const map = new Map<ProspectStage, Prospect[]>();
    for (const stage of BOARD_STAGES) map.set(stage, []);
    for (const p of prospects) {
      if (!map.has(p.stage)) map.set(p.stage, []);
      map.get(p.stage)!.push(p);
    }
    return map;
  }, [prospects]);

  const activeProspect = activeId ? prospects.find((p) => p.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const stage = String(over.id) as ProspectStage;
    const prospect = prospects.find((p) => p.id === String(active.id));
    if (!prospect || prospect.stage === stage) return;

    const previous = prospects;
    // Otimista: a coluna reage na hora e volta atrás se a API recusar.
    setProspects((list) =>
      list.map((p) => (p.id === prospect.id ? { ...p, stage } : p)),
    );

    try {
      await api.patch(`/prospects/${prospect.id}/stage`, { stage });
      load();
    } catch {
      setProspects(previous);
      toast.error('Não foi possível mover');
    }
  }

  async function handleExport() {
    try {
      const params = listId !== 'all' ? `?listId=${listId}` : '';
      const res = await api.get(`/prospects/export${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'prospeccao.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Não foi possível exportar');
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Kanban}
        title="Quadro de prospecção"
        description="Arraste para mudar a etapa"
        count={prospects.length}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1 size-3.5" />
              Exportar CSV
            </Button>
            <Link
              href="/prospecting/import"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              <Upload className="mr-1 size-3.5" />
              Importar
            </Link>
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="mr-1 size-3.5" />
              Novo prospect
            </Button>
          </>
        }
      />

      {showForm && (
        <NewProspectForm
          lists={lists}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nome, negócio, @ ou telefone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

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

        <Select value={channel} onValueChange={(v) => setChannel(v ?? 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue>
              {channel === 'all'
                ? 'Todos os canais'
                : CHANNEL_META[channel as ProspectChannel].label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            {Object.entries(CHANNEL_META).map(([key, meta]) => (
              <SelectItem key={key} value={key}>
                {meta.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto">
          {BOARD_STAGES.map((s) => (
            <Skeleton key={s} className="h-96 w-72 shrink-0" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={(args) => {
            const pointer = pointerWithin(args);
            return pointer.length > 0 ? pointer : rectIntersection(args);
          }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-4">
            {BOARD_STAGES.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                items={byStage.get(stage) ?? []}
                onOpen={setDrawerId}
              />
            ))}
          </div>

          <DragOverlay>
            {activeProspect && (
              <div className="w-72 rotate-2 opacity-90">
                <ProspectCard prospect={activeProspect} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <ProspectDrawer
        prospectId={drawerId}
        onOpenChange={(open) => !open && setDrawerId(null)}
        onChanged={load}
      />
    </div>
  );
}

function StageColumn({
  stage,
  items,
  onOpen,
}: {
  stage: ProspectStage;
  items: Prospect[];
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const meta = STAGE_META[stage];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors',
        isOver && 'border-foreground/30 bg-muted/60',
      )}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <span className={cn('size-2 rounded-full', meta.dot)} />
        <span className="flex-1 text-sm font-semibold">{meta.label}</span>
        <span className="rounded bg-background px-1.5 py-0.5 text-xs text-muted-foreground">
          {items.length}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {items.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Vazio</p>
        ) : (
          items.map((p) => (
            <DraggableProspect key={p.id} prospect={p} onOpen={() => onOpen(p.id)} />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableProspect({
  prospect,
  onOpen,
}: {
  prospect: Prospect;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: prospect.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(isDragging && 'opacity-40')}
    >
      <ProspectCard prospect={prospect} onClick={onOpen} />
    </div>
  );
}
