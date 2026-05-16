'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Target, CheckCircle2, X } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import Link from 'next/link';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type View = 'day' | 'week' | 'month';

interface TaskEvent {
  id: string;
  title: string;
  dueDate: string;
  completedAt: string | null;
  priority: string;
  lead: { id: string; title: string };
}

interface LeadEvent {
  id: string;
  title: string;
  expectedCloseDate: string;
  status: { name: string; color: string };
  pipelineId: string;
}

interface LeadOption {
  id: string;
  title: string;
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 07h-21h

const PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-slate-400',
  MEDIUM: 'bg-blue-500',
  HIGH: 'bg-orange-500',
  URGENT: 'bg-red-500',
};

export default function CalendarPage() {
  const [view, setView] = useState<View>('week');
  const [refDate, setRefDate] = useState(new Date());
  const [tasks, setTasks] = useState<TaskEvent[]>([]);
  const [leads, setLeads] = useState<LeadEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | null>(null);
  const [draftLeadId, setDraftLeadId] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [saving, setSaving] = useState(false);

  // Range baseado na view
  const range = useMemo(() => {
    if (view === 'day') {
      return { start: startOfDay(refDate), end: addDays(startOfDay(refDate), 1) };
    }
    if (view === 'week') {
      return {
        start: startOfWeek(refDate, { weekStartsOn: 1 }),
        end: endOfWeek(refDate, { weekStartsOn: 1 }),
      };
    }
    // month
    return {
      start: startOfWeek(startOfMonth(refDate), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(refDate), { weekStartsOn: 1 }),
    };
  }, [view, refDate]);

  // Load events + leads pra dropdown
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const tasksRes = await api.get('/tasks/mine');
        const tasksInRange: TaskEvent[] = (tasksRes.data.data ?? []).filter(
          (t: TaskEvent) =>
            t.dueDate &&
            new Date(t.dueDate) >= range.start &&
            new Date(t.dueDate) <= range.end,
        );
        setTasks(tasksInRange);

        const pipelinesRes = await api.get('/pipelines');
        const allPipelines: { id: string; name: string }[] = pipelinesRes.data.data ?? [];

        const leadsByPipeline = await Promise.all(
          allPipelines.map((p) =>
            api
              .get(`/pipelines/${p.id}/leads`)
              .then((r) => {
                const raw = r.data.data ?? [];
                return raw.map((l: LeadEvent & { pipelineId?: string }) => ({
                  ...l,
                  pipelineId: p.id,
                }));
              })
              .catch(() => []),
          ),
        );

        const allLeads = leadsByPipeline.flat();
        setLeads(
          allLeads.filter(
            (l: LeadEvent) =>
              l.expectedCloseDate &&
              new Date(l.expectedCloseDate) >= range.start &&
              new Date(l.expectedCloseDate) <= range.end,
          ),
        );
        setLeadOptions(allLeads.map((l: LeadEvent) => ({ id: l.id, title: l.title })));
      } catch {
        toast.error('Erro ao carregar calendário');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [range.start, range.end]);

  // Navigation
  const goPrev = () => {
    if (view === 'day') setRefDate(subDays(refDate, 1));
    else if (view === 'week') setRefDate(subWeeks(refDate, 1));
    else setRefDate(subMonths(refDate, 1));
  };
  const goNext = () => {
    if (view === 'day') setRefDate(addDays(refDate, 1));
    else if (view === 'week') setRefDate(addWeeks(refDate, 1));
    else setRefDate(addMonths(refDate, 1));
  };
  const goToday = () => setRefDate(new Date());

  // Quick-create dialog
  const openCreate = (date: Date) => {
    setDraftDate(date);
    setDraftLeadId('');
    setDraftTitle('');
    setDialogOpen(true);
  };

  const submitCreate = async () => {
    if (!draftLeadId) return toast.error('Selecione um lead');
    if (!draftTitle.trim()) return toast.error('Informe o título');
    setSaving(true);
    try {
      await api.post(`/leads/${draftLeadId}/tasks`, {
        title: draftTitle.trim(),
        dueDate: draftDate?.toISOString(),
      });
      toast.success('Evento criado');
      setDialogOpen(false);
      setRefDate(new Date(refDate)); // refetch
    } catch {
      toast.error('Erro ao criar evento');
    } finally {
      setSaving(false);
    }
  };

  // Helpers
  const tasksOnDay = useCallback(
    (day: Date) =>
      tasks.filter((t) => format(new Date(t.dueDate), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')),
    [tasks],
  );
  const leadsOnDay = useCallback(
    (day: Date) =>
      leads.filter(
        (l) => format(new Date(l.expectedCloseDate), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'),
      ),
    [leads],
  );
  const tasksAtHour = useCallback(
    (day: Date, hour: number) =>
      tasks.filter((t) => {
        const d = new Date(t.dueDate);
        return (
          format(d, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') && d.getHours() === hour
        );
      }),
    [tasks],
  );

  const headerLabel = useMemo(() => {
    if (view === 'day') return format(refDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    if (view === 'week') {
      const start = startOfWeek(refDate, { weekStartsOn: 1 });
      const end = endOfWeek(refDate, { weekStartsOn: 1 });
      return `${format(start, 'dd', { locale: ptBR })}-${format(end, "dd 'de' MMMM yyyy", { locale: ptBR })}`;
    }
    return format(refDate, "MMMM 'de' yyyy", { locale: ptBR });
  }, [view, refDate]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold capitalize">{headerLabel}</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border p-0.5">
            {(['day', 'week', 'month'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  'rounded px-3 py-1 text-xs font-semibold uppercase transition-colors',
                  view === v ? 'bg-emerald-100 text-emerald-700' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>

          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" onClick={goPrev}><ChevronLeft className="size-4" /></Button>
            <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
            <Button variant="outline" size="icon-sm" onClick={goNext}><ChevronRight className="size-4" /></Button>
          </div>

          <Button size="sm" onClick={() => openCreate(new Date())}>+ Novo evento</Button>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[600px] w-full" />
      ) : view === 'month' ? (
        <MonthView
          refDate={refDate}
          tasksOnDay={tasksOnDay}
          leadsOnDay={leadsOnDay}
          openCreate={openCreate}
        />
      ) : (
        <TimelineView
          view={view}
          refDate={refDate}
          tasksAtHour={tasksAtHour}
          leadsOnDay={leadsOnDay}
          openCreate={openCreate}
        />
      )}

      {/* Dialog criar evento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Lead</Label>
              <Select value={draftLeadId} onValueChange={(v) => setDraftLeadId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Escolher lead" /></SelectTrigger>
                <SelectContent>
                  {leadOptions.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">Sem leads</p>
                  ) : (
                    leadOptions.slice(0, 50).map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Título</Label>
              <Input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Ex: Reunião de qualificação"
              />
            </div>
            <div className="space-y-1">
              <Label>Quando</Label>
              <Input
                type="datetime-local"
                value={draftDate ? format(draftDate, "yyyy-MM-dd'T'HH:mm") : ''}
                onChange={(e) => setDraftDate(new Date(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={submitCreate} disabled={saving}>
              {saving ? 'Criando...' : 'Criar evento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Month View ──────────────────────────────────────────────

function MonthView({
  refDate,
  tasksOnDay,
  leadsOnDay,
  openCreate,
}: {
  refDate: Date;
  tasksOnDay: (d: Date) => TaskEvent[];
  leadsOnDay: (d: Date) => LeadEvent[];
  openCreate: (d: Date) => void;
}) {
  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(refDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(refDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [refDate]);

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {gridDays.map((day, idx) => {
          const inMonth = isSameMonth(day, refDate);
          const today = isToday(day);
          const dayTasks = tasksOnDay(day);
          const dayLeads = leadsOnDay(day);
          const total = dayTasks.length + dayLeads.length;

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => openCreate(new Date(day.setHours(9, 0, 0, 0)))}
              className={cn(
                'flex min-h-[110px] flex-col gap-1 border-b border-r p-1.5 text-left transition-colors',
                !inMonth && 'bg-muted/20 text-muted-foreground',
                today && 'bg-blue-50/50',
                'hover:bg-muted/30',
                idx % 7 === 6 && 'border-r-0',
                idx >= gridDays.length - 7 && 'border-b-0',
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                  today && 'bg-blue-600 text-white',
                )}>
                  {format(day, 'd')}
                </span>
                {total > 3 && <span className="text-[10px] text-muted-foreground">+{total - 3}</span>}
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayTasks.slice(0, 2).map((t) => (
                  <div key={t.id} className={cn(
                    'flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px]',
                    t.completedAt ? 'bg-zinc-100 text-zinc-500 line-through' : 'bg-blue-100 text-blue-700',
                  )}>
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', PRIORITY_DOT[t.priority] ?? PRIORITY_DOT.MEDIUM)} />
                    <span className="truncate">{t.title}</span>
                  </div>
                ))}
                {dayLeads.slice(0, Math.max(0, 3 - dayTasks.length)).map((l) => (
                  <div key={l.id} className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] text-white"
                    style={{ backgroundColor: l.status.color }}>
                    <Target className="size-2.5 shrink-0" />
                    <span className="truncate">{l.title}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day / Week timeline view ────────────────────────────────

function TimelineView({
  view,
  refDate,
  tasksAtHour,
  leadsOnDay,
  openCreate,
}: {
  view: 'day' | 'week';
  refDate: Date;
  tasksAtHour: (d: Date, hour: number) => TaskEvent[];
  leadsOnDay: (d: Date) => LeadEvent[];
  openCreate: (d: Date) => void;
}) {
  const days = useMemo(() => {
    if (view === 'day') return [refDate];
    const start = startOfWeek(refDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [view, refDate]);

  const colsClass = view === 'day' ? 'grid-cols-[60px_1fr]' : 'grid-cols-[60px_repeat(7,1fr)]';

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      {/* Header: dias da semana */}
      <div className={cn('grid border-b bg-muted/30', colsClass)}>
        <div /> {/* canto vazio */}
        {days.map((day) => {
          const today = isToday(day);
          return (
            <div key={day.toISOString()} className="px-2 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                {format(day, 'EEE', { locale: ptBR })}
              </p>
              <p className={cn(
                'mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold',
                today && 'bg-blue-600 text-white',
              )}>
                {format(day, 'd')}
              </p>
            </div>
          );
        })}
      </div>

      {/* All-day row: leads com expectedCloseDate */}
      <div className={cn('grid border-b text-[10px]', colsClass)}>
        <div className="px-2 py-1.5 text-right text-muted-foreground">Dia todo</div>
        {days.map((day) => {
          const dayLeads = leadsOnDay(day);
          return (
            <div key={day.toISOString()} className="flex flex-col gap-0.5 border-l px-1 py-1">
              {dayLeads.map((l) => (
                <Link key={l.id} href={`/pipelines/${l.pipelineId}/board`}
                  className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] text-white"
                  style={{ backgroundColor: l.status.color }}>
                  <Target className="size-2.5 shrink-0" />
                  <span className="truncate">{l.title}</span>
                </Link>
              ))}
            </div>
          );
        })}
      </div>

      {/* Hours grid */}
      <div>
        {HOURS.map((hour) => (
          <div key={hour} className={cn('grid border-b', colsClass)}>
            <div className="px-2 py-1 text-right text-[10px] text-muted-foreground">
              {String(hour).padStart(2, '0')}:00
            </div>
            {days.map((day) => {
              const slot = new Date(day);
              slot.setHours(hour, 0, 0, 0);
              const events = tasksAtHour(day, hour);
              return (
                <button
                  key={day.toISOString() + hour}
                  type="button"
                  onClick={() => openCreate(slot)}
                  className="relative min-h-[44px] border-l text-left transition-colors hover:bg-blue-50/30"
                >
                  {events.map((t) => (
                    <div key={t.id} className={cn(
                      'absolute inset-x-1 top-1 flex items-center gap-1 truncate rounded px-1.5 py-1 text-[10px]',
                      t.completedAt ? 'bg-zinc-100 text-zinc-500 line-through' : 'bg-blue-500 text-white',
                    )}>
                      <CheckCircle2 className="size-2.5 shrink-0" />
                      <span className="truncate">{format(new Date(t.dueDate), 'HH:mm')} {t.title}</span>
                    </div>
                  ))}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
