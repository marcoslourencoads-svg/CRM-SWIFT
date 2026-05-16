'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Phone,
  Users as MeetingIcon,
  CheckSquare,
  AlertTriangle,
  Mail,
  Utensils,
  Calendar as CalendarIcon,
  List,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { format, startOfDay, endOfDay, addDays, endOfWeek, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

type TaskType = 'TASK' | 'CALL' | 'MEETING' | 'EMAIL' | 'DEADLINE' | 'LUNCH';
type PeriodFilter = 'todo' | 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'next_week';

interface Activity {
  id: string;
  title: string;
  type: TaskType;
  dueDate: string | null;
  completedAt: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  lead: { id: string; title: string };
  assignee: { id: string; name: string } | null;
}

const TYPE_META: Record<TaskType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  TASK: { label: 'Tarefa', icon: CheckSquare, color: 'text-slate-600' },
  CALL: { label: 'Ligação', icon: Phone, color: 'text-blue-600' },
  MEETING: { label: 'Reunião', icon: MeetingIcon, color: 'text-purple-600' },
  EMAIL: { label: 'E-mail', icon: Mail, color: 'text-cyan-600' },
  DEADLINE: { label: 'Prazo', icon: AlertTriangle, color: 'text-red-600' },
  LUNCH: { label: 'Almoço', icon: Utensils, color: 'text-amber-600' },
};

const PERIOD_LABEL: Record<PeriodFilter, string> = {
  todo: 'A fazer',
  overdue: 'Atrasadas',
  today: 'Hoje',
  tomorrow: 'Amanhã',
  this_week: 'Esta semana',
  next_week: 'Próxima semana',
};

const PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-slate-300',
  MEDIUM: 'bg-blue-500',
  HIGH: 'bg-orange-500',
  URGENT: 'bg-red-500',
};

function getRange(period: PeriodFilter): { from?: Date; to?: Date; status?: string } {
  const now = new Date();
  switch (period) {
    case 'todo':
      return { status: 'pending' };
    case 'overdue':
      return { status: 'overdue' };
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'tomorrow':
      return { from: startOfDay(addDays(now, 1)), to: endOfDay(addDays(now, 1)) };
    case 'this_week':
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case 'next_week':
      return {
        from: startOfWeek(addDays(now, 7), { weekStartsOn: 1 }),
        to: endOfWeek(addDays(now, 7), { weekStartsOn: 1 }),
      };
  }
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TaskType | 'ALL'>('ALL');
  const [period, setPeriod] = useState<PeriodFilter>('todo');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const range = getRange(period);
      const params = new URLSearchParams();
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (range.status) params.set('status', range.status);
      if (range.from) params.set('from', range.from.toISOString());
      if (range.to) params.set('to', range.to.toISOString());

      const res = await api.get(`/tasks?${params}`);
      setActivities(res.data.data ?? []);
    } catch (err: any) {
      if (err?.response?.status >= 500) {
        toast.error('Erro ao carregar atividades');
      } else {
        console.warn('[/activities] falha não-fatal:', err?.message);
        setActivities([]);
      }
    } finally {
      setLoading(false);
    }
  }, [period, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const toggleDone = async (act: Activity) => {
    try {
      if (!act.completedAt) {
        await api.patch(`/tasks/${act.id}/complete`);
      }
      load();
    } catch {
      toast.error('Erro ao marcar como feito');
    }
  };

  const summary = useMemo(() => {
    const total = activities.length;
    const done = activities.filter((a) => a.completedAt).length;
    return { total, done };
  }, [activities]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <List className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Atividades</h1>
          <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {summary.total} {summary.total === 1 ? 'item' : 'itens'}
          </span>
        </div>
        <div className="flex gap-1 rounded-md border p-0.5">
          <Link
            href="/activities"
            className="flex items-center gap-1 rounded bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
          >
            <List className="size-3" /> Lista
          </Link>
          <Link
            href="/calendar"
            className="flex items-center gap-1 rounded px-3 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            <CalendarIcon className="size-3" /> Calendário
          </Link>
        </div>
      </div>

      {/* Filtros tipo */}
      <div className="flex flex-wrap gap-1 border-b">
        <FilterTab
          label="Todas"
          active={typeFilter === 'ALL'}
          onClick={() => setTypeFilter('ALL')}
        />
        {(Object.keys(TYPE_META) as TaskType[]).map((t) => {
          const Icon = TYPE_META[t].icon;
          return (
            <FilterTab
              key={t}
              label={TYPE_META[t].label}
              icon={Icon}
              active={typeFilter === t}
              onClick={() => setTypeFilter(t)}
            />
          );
        })}
      </div>

      {/* Filtros período */}
      <div className="flex flex-wrap gap-1">
        {(Object.keys(PERIOD_LABEL) as PeriodFilter[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              period === p
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : activities.length === 0 ? (
        <EmptyState
          icon={List}
          title="Nenhuma atividade nesse filtro"
          description="Mude o tipo ou o período pra ver outras tarefas. Crie atividades no drawer do lead."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2"></th>
                <th className="w-10 px-2 py-2"></th>
                <th className="px-3 py-2 text-left font-semibold">Assunto</th>
                <th className="px-3 py-2 text-left font-semibold">Lead</th>
                <th className="px-3 py-2 text-left font-semibold">Responsável</th>
                <th className="w-10 px-3 py-2"></th>
                <th className="px-3 py-2 text-left font-semibold">Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => {
                const Icon = TYPE_META[a.type].icon;
                const overdue =
                  a.dueDate && !a.completedAt && new Date(a.dueDate) < new Date();
                return (
                  <tr
                    key={a.id}
                    className={cn(
                      'border-b last:border-b-0 hover:bg-muted/30',
                      a.completedAt && 'opacity-60',
                    )}
                  >
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleDone(a)}
                        className="text-muted-foreground hover:text-emerald-600"
                        title={a.completedAt ? 'Concluída' : 'Marcar como feita'}
                      >
                        {a.completedAt ? (
                          <CheckCircle2 className="size-4 text-emerald-600" />
                        ) : (
                          <Circle className="size-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-2">
                      <Icon className={cn('size-4', TYPE_META[a.type].color)} />
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn(a.completedAt && 'line-through')}>{a.title}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <Link
                        href={`/leads/${a.lead.id}`}
                        className="text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {a.lead.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {a.assignee?.name ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={cn('inline-block size-2 rounded-full', PRIORITY_DOT[a.priority])}
                        title={a.priority}
                      />
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-xs',
                        overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground',
                      )}
                    >
                      {a.dueDate
                        ? format(new Date(a.dueDate), "dd/MM 'às' HH:mm", { locale: ptBR })
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterTab({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
        active
          ? 'border-emerald-500 text-emerald-700'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {Icon && <Icon className="size-3" />}
      {label}
    </button>
  );
}
