'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AlarmClock,
  CalendarCheck,
  CheckCheck,
  Flame,
  Inbox,
  PlayCircle,
  Plus,
  Send,
  Target,
  Upload,
  X,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { ProspectCard } from '@/components/prospecting/prospect-card';
import { ProspectDrawer } from '@/components/prospecting/prospect-drawer';
import { RegisterTouchDialog } from '@/components/prospecting/register-touch-dialog';
import { NewProspectForm } from '@/components/prospecting/new-prospect-form';
import { nextTouchLabel, type Prospect, type ProspectList } from '@/lib/prospecting';

interface Queue {
  atrasados: Prospect[];
  hoje: Prospect[];
  naoIniciados: Prospect[];
  cadenciaEsgotada: Prospect[];
  counts: {
    atrasados: number;
    hoje: number;
    naoIniciados: number;
    cadenciaEsgotada: number;
  };
}

const EMPTY_QUEUE: Queue = {
  atrasados: [],
  hoje: [],
  naoIniciados: [],
  cadenciaEsgotada: [],
  counts: { atrasados: 0, hoje: 0, naoIniciados: 0, cadenciaEsgotada: 0 },
};

/**
 * Fila do dia — o painel que cobra.
 *
 * A planilha guardava a data do follow-up depois que ele acontecia, o
 * que tornava impossível responder "quem eu toco hoje?". Aqui o
 * nextActionAt é agendado pela cadência no momento do toque anterior, e
 * esta tela é só a leitura dele.
 */
export default function ProspectingQueuePage() {
  const [queue, setQueue] = useState<Queue>(EMPTY_QUEUE);
  const [lists, setLists] = useState<ProspectList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [touchTarget, setTouchTarget] = useState<Prospect | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // O servidor roda em UTC; manda o fuso de quem olha para que
      // "hoje" e "atrasado" batam com o relógio do operador.
      const tz = new Date().getTimezoneOffset();
      const [queueRes, listsRes] = await Promise.all([
        api.get(`/prospects/queue?tzOffset=${tz}`),
        api.get('/prospect-lists'),
      ]);
      setQueue(queueRes.data.data ?? EMPTY_QUEUE);
      setLists(listsRes.data.data ?? []);
    } catch {
      toast.error('Não foi possível carregar a fila');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Sem resposta: empurra para a próxima data da cadência sem abrir
  // diálogo. É o caminho mais percorrido da operação.
  async function registrarSemResposta(p: Prospect) {
    try {
      await api.post(`/prospects/${p.id}/touches`, { outcome: 'NO_REPLY' });
      toast.success(`${nextTouchLabel(p)} registrado`);
      load();
    } catch {
      toast.error('Não foi possível registrar');
    }
  }

  async function marcarRespondeu(p: Prospect) {
    try {
      await api.post(`/prospects/${p.id}/touches`, { outcome: 'REPLIED_POSITIVE' });
      toast.success('Respondeu! Prospect movido para "Respondeu"');
      load();
    } catch {
      toast.error('Não foi possível registrar');
    }
  }

  async function descartar(p: Prospect) {
    try {
      await api.patch(`/prospects/${p.id}/stage`, { stage: 'DISQUALIFIED' });
      toast.success('Prospect descartado');
      load();
    } catch {
      toast.error('Não foi possível descartar');
    }
  }

  const total =
    queue.counts.atrasados + queue.counts.hoje + queue.counts.naoIniciados;

  const actionsFor = (p: Prospect) => (
    <>
      <Button size="sm" variant="outline" onClick={() => setTouchTarget(p)}>
        <Send className="mr-1 size-3" />
        {nextTouchLabel(p)}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => marcarRespondeu(p)}>
        <CheckCheck className="mr-1 size-3" />
        Respondeu
      </Button>
      <Button size="sm" variant="ghost" onClick={() => registrarSemResposta(p)}>
        Sem resposta
      </Button>
      <Button size="sm" variant="ghost" onClick={() => descartar(p)}>
        <X className="mr-1 size-3" />
        Descartar
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Target}
        title="Fila do dia"
        description="O que precisa ser tocado hoje na prospecção ativa"
        count={total}
        actions={
          <>
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

      {/* Resumo do que a fila cobra */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={AlarmClock}
          label="Atrasados"
          value={queue.counts.atrasados}
          tone="danger"
        />
        <SummaryCard icon={Flame} label="Para hoje" value={queue.counts.hoje} tone="warn" />
        <SummaryCard
          icon={PlayCircle}
          label="Ainda não abordados"
          value={queue.counts.naoIniciados}
          tone="neutral"
        />
        <SummaryCard
          icon={CalendarCheck}
          label="Cadência esgotada"
          value={queue.counts.cadenciaEsgotada}
          tone="neutral"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : total + queue.counts.cadenciaEsgotada === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Fila vazia"
          description="Nenhum prospect pendente. Adicione contatos ou importe sua planilha para começar a prospecção."
          action={
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setShowForm(true)}>
                Novo prospect
              </Button>
              <Link
                href="/prospecting/import"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Importar planilha
              </Link>
            </div>
          }
        />
      ) : (
        <div className="space-y-6">
          <Section
            title="Atrasados"
            description="Passaram da data e ainda não foram tocados."
            tone="danger"
            items={queue.atrasados}
            onOpen={setDrawerId}
            actionsFor={actionsFor}
          />
          <Section
            title="Para hoje"
            description="A cadência agendou o toque para hoje."
            tone="warn"
            items={queue.hoje}
            onOpen={setDrawerId}
            actionsFor={actionsFor}
          />
          <Section
            title="Ainda não abordados"
            description="Estão na lista e nunca receberam o primeiro toque."
            tone="neutral"
            items={queue.naoIniciados}
            onOpen={setDrawerId}
            actionsFor={actionsFor}
          />
          <Section
            title="Cadência esgotada"
            description="Receberam todos os toques da lista e não responderam. Decida: insistir com nova data, ou marcar como perdido."
            tone="neutral"
            items={queue.cadenciaEsgotada}
            onOpen={setDrawerId}
            actionsFor={actionsFor}
          />
        </div>
      )}

      <ProspectDrawer
        prospectId={drawerId}
        onOpenChange={(open) => !open && setDrawerId(null)}
        onChanged={load}
      />
      <RegisterTouchDialog
        open={!!touchTarget}
        onOpenChange={(open) => !open && setTouchTarget(null)}
        prospect={touchTarget}
        onSuccess={load}
      />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: 'danger' | 'warn' | 'neutral';
}) {
  const toneClass = {
    danger: 'bg-red-100 text-red-700',
    warn: 'bg-amber-100 text-amber-700',
    neutral: 'bg-muted text-muted-foreground',
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('flex size-9 items-center justify-center rounded-lg', toneClass)}>
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  description,
  tone,
  items,
  onOpen,
  actionsFor,
}: {
  title: string;
  description: string;
  tone: 'danger' | 'warn' | 'neutral';
  items: Prospect[];
  onOpen: (id: string) => void;
  actionsFor: (p: Prospect) => React.ReactNode;
}) {
  if (items.length === 0) return null;

  const bar = {
    danger: 'bg-red-500',
    warn: 'bg-amber-500',
    neutral: 'bg-slate-400',
  }[tone];

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className={cn('h-4 w-1 rounded-full', bar)} />
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {items.length}
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{description}</p>
      <div className="grid gap-2 lg:grid-cols-2">
        {items.map((p) => (
          <ProspectCard
            key={p.id}
            prospect={p}
            showStage
            onClick={() => onOpen(p.id)}
            actions={actionsFor(p)}
          />
        ))}
      </div>
    </section>
  );
}
