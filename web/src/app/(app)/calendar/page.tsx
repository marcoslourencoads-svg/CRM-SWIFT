'use client';

import { useEffect, useState, useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, Target } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
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

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700 border-slate-200',
  MEDIUM: 'bg-blue-100 text-blue-700 border-blue-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  URGENT: 'bg-red-100 text-red-700 border-red-200',
};

export default function CalendarPage() {
  const [refDate, setRefDate] = useState(new Date());
  const [tasks, setTasks] = useState<TaskEvent[]>([]);
  const [leads, setLeads] = useState<LeadEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Tasks do mês
        const tasksRes = await api.get('/tasks/mine?status=pending');
        const monthStart = startOfMonth(refDate);
        const monthEnd = endOfMonth(refDate);
        const tasksInMonth: TaskEvent[] = (tasksRes.data.data ?? []).filter(
          (t: TaskEvent) =>
            t.dueDate &&
            new Date(t.dueDate) >= monthStart &&
            new Date(t.dueDate) <= monthEnd,
        );
        setTasks(tasksInMonth);

        // Leads com expectedCloseDate no mês — pra cada pipeline do user
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
                      new Date(l.expectedCloseDate) >= monthStart &&
                      new Date(l.expectedCloseDate) <= monthEnd,
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

  // Agrupa eventos por dia do mês
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">
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
        <Skeleton className="h-96 w-full" />
      ) : eventsByDay.size === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-12 text-center text-sm text-muted-foreground">
          Nenhuma tarefa ou lead com previsão de fechamento neste mês.
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from(eventsByDay.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, evts]) => (
              <div key={day} className="rounded-lg border">
                <div className="border-b bg-muted/30 px-3 py-2">
                  <p className="text-sm font-semibold">
                    {format(new Date(day), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                </div>
                <div className="divide-y">
                  {evts.tasks.map((t) => (
                    <div key={'t-' + t.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span
                        className={cn(
                          'inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                          PRIORITY_COLORS[t.priority] ?? PRIORITY_COLORS.MEDIUM,
                        )}
                      >
                        <CheckCircle2 className="mr-0.5 size-3" />
                        Tarefa
                      </span>
                      <span className="font-medium">{t.title}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {format(new Date(t.dueDate), 'HH:mm')}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <Link
                        href={`#`}
                        className="text-blue-600 hover:underline"
                      >
                        {t.lead.title}
                      </Link>
                    </div>
                  ))}
                  {evts.leads.map((l) => (
                    <div key={'l-' + l.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span
                        className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ backgroundColor: l.status.color }}
                      >
                        <Target className="mr-0.5 size-3" />
                        Fechamento
                      </span>
                      <Link
                        href={`/pipelines/${l.pipelineId}/board`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {l.title}
                      </Link>
                      <span className="text-muted-foreground">· {l.status.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
