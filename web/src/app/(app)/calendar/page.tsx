'use client';

import { useEffect, useState, useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, Target, X } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import Link from 'next/link';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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

interface Pipeline {
  id: string;
  name: string;
}

const PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-slate-400',
  MEDIUM: 'bg-blue-500',
  HIGH: 'bg-orange-500',
  URGENT: 'bg-red-500',
};

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function CalendarPage() {
  const [refDate, setRefDate] = useState(new Date());
  const [tasks, setTasks] = useState<TaskEvent[]>([]);
  const [leads, setLeads] = useState<LeadEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const monthStart = startOfMonth(refDate);
        const monthEnd = endOfMonth(refDate);
        // Carrega 1 semana antes e depois pra preencher a grid
        const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

        const tasksRes = await api.get('/tasks/mine');
        const tasksInRange: TaskEvent[] = (tasksRes.data.data ?? []).filter(
          (t: TaskEvent) =>
            t.dueDate &&
            new Date(t.dueDate) >= gridStart &&
            new Date(t.dueDate) <= gridEnd,
        );
        setTasks(tasksInRange);

        const pipelinesRes = await api.get('/pipelines');
        const allPipelines: Pipeline[] = pipelinesRes.data.data ?? [];

        const leadsByPipeline = await Promise.all(
          allPipelines.map((p) =>
            api
              .get(`/pipelines/${p.id}/leads`)
              .then((r) =>
                (r.data.data ?? [])
                  .filter(
                    (l: LeadEvent) =>
                      l.expectedCloseDate &&
                      new Date(l.expectedCloseDate) >= gridStart &&
                      new Date(l.expectedCloseDate) <= gridEnd,
                  )
                  .map((l: LeadEvent) => ({ ...l, pipelineId: p.id })),
              )
              .catch(() => []),
          ),
        );
        setLeads(leadsByPipeline.flat());
      } catch {
        toast.error('Erro ao carregar calendário');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refDate]);

  // Grid days = todas as células do mês incluindo dias do mês anterior/próximo pra completar semanas
  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(refDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(refDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [refDate]);

  // Eventos agrupados por dia (yyyy-MM-dd)
  const eventsByDay = useMemo(() => {
    const map = new Map<string, { tasks: TaskEvent[]; leads: LeadEvent[] }>();
    for (const t of tasks) {
      const key = format(new Date(t.dueDate), 'yyyy-MM-dd');
      const entry = map.get(key) ?? { tasks: [], leads: [] };
      entry.tasks.push(t);
      map.set(key, entry);
    }
    for (const l of leads) {
      const key = format(new Date(l.expectedCloseDate), 'yyyy-MM-dd');
      const entry = map.get(key) ?? { tasks: [], leads: [] };
      entry.leads.push(l);
      map.set(key, entry);
    }
    return map;
  }, [tasks, leads]);

  const selectedEvents = selectedDay
    ? eventsByDay.get(format(selectedDay, 'yyyy-MM-dd'))
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold capitalize">
            {format(refDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </h1>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => setRefDate(subMonths(refDate, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRefDate(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => setRefDate(addMonths(refDate, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[600px] w-full" />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-background">
          {/* Header dos dias da semana */}
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid de dias */}
          <div className="grid grid-cols-7 auto-rows-fr">
            {gridDays.map((day, idx) => {
              const key = format(day, 'yyyy-MM-dd');
              const events = eventsByDay.get(key);
              const inMonth = isSameMonth(day, refDate);
              const today = isToday(day);
              const totalEvents = (events?.tasks.length ?? 0) + (events?.leads.length ?? 0);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(day)}
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
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                        today && 'bg-blue-600 text-white',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {totalEvents > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{totalEvents - 3}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {events?.tasks.slice(0, 2).map((t) => (
                      <div
                        key={t.id}
                        className={cn(
                          'flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px]',
                          t.completedAt
                            ? 'bg-zinc-100 text-zinc-500 line-through'
                            : 'bg-blue-100 text-blue-700',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            PRIORITY_DOT[t.priority] ?? PRIORITY_DOT.MEDIUM,
                          )}
                        />
                        <CheckCircle2 className="size-2.5 shrink-0" />
                        <span className="truncate">{t.title}</span>
                      </div>
                    ))}
                    {events?.leads.slice(0, Math.max(0, 3 - (events?.tasks.length ?? 0))).map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] text-white"
                        style={{ backgroundColor: l.status.color }}
                      >
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
      )}

      {/* Side panel ao clicar num dia */}
      {selectedDay && selectedEvents && (selectedEvents.tasks.length > 0 || selectedEvents.leads.length > 0) && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold capitalize">
              {format(selectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h2>
            <Button variant="ghost" size="icon-sm" onClick={() => setSelectedDay(null)}>
              <X className="size-3" />
            </Button>
          </div>

          <div className="space-y-2">
            {selectedEvents.tasks.map((t) => (
              <div key={t.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    PRIORITY_DOT[t.priority] ?? PRIORITY_DOT.MEDIUM,
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className={cn('font-medium', t.completedAt && 'line-through text-muted-foreground')}>
                    {t.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(t.dueDate), 'HH:mm')} · {t.lead.title}
                  </p>
                </div>
              </div>
            ))}
            {selectedEvents.leads.map((l) => (
              <Link
                key={l.id}
                href={`/pipelines/${l.pipelineId}/board`}
                className="flex items-start gap-2 rounded-md border p-2 text-sm hover:bg-muted/30"
              >
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: l.status.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{l.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Previsão de fechamento · {l.status.name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
