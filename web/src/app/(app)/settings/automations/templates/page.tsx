'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Zap, MessageSquare, Trophy, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  build: () => Record<string, unknown>;
}

const TEMPLATES: Template[] = [
  {
    id: 'welcome',
    name: 'Boas-vindas a lead novo',
    description: 'Quando um lead chega no sistema, cria tarefa "Ligar em 1h" + adiciona tag "Novo".',
    icon: <Zap className="size-5 text-emerald-600" />,
    build: () => ({
      name: 'Boas-vindas a lead novo',
      trigger: { type: 'LEAD_CREATED' },
      conditions: [],
      actions: [
        { type: 'ADD_TAG', params: { tagName: 'Novo' } },
        {
          type: 'CREATE_TASK',
          params: {
            title: 'Ligar pro lead nas próximas horas',
            dueDateOffsetMinutes: 60,
          },
        },
      ],
      isActive: true,
    }),
  },
  {
    id: 'won-notify',
    name: 'Notificar quando lead é fechado',
    description: 'Quando lead vai pra etapa "Ganho", cria nota celebrando 🎉 + dispara webhook.',
    icon: <Trophy className="size-5 text-amber-600" />,
    build: () => ({
      name: 'Lead ganho — celebrar',
      trigger: { type: 'STATUS_CHANGED' },
      conditions: [
        { field: 'status.isWon', operator: 'EQUALS', value: true },
      ],
      actions: [
        {
          type: 'CREATE_NOTE',
          params: { content: '🎉 Lead fechado! Comemorar com a equipe.' },
        },
      ],
      isActive: true,
    }),
  },
  {
    id: 'recovery',
    name: 'Follow-up de lead frio',
    description: 'Quando tag "Recovery" é adicionada, cria tarefa "Tentar reativar".',
    icon: <Clock className="size-5 text-blue-600" />,
    build: () => ({
      name: 'Reativar lead frio',
      trigger: { type: 'TAG_ADDED' },
      conditions: [],
      actions: [
        {
          type: 'CREATE_TASK',
          params: {
            title: 'Tentar reativar lead (mandar mensagem ou ligar)',
            dueDateOffsetMinutes: 120,
          },
        },
      ],
      isActive: true,
    }),
  },
  {
    id: 'task-followup',
    name: 'Follow-up após tarefa concluída',
    description: 'Quando vendedor conclui uma tarefa, cria tarefa de follow-up em 3 dias.',
    icon: <MessageSquare className="size-5 text-violet-600" />,
    build: () => ({
      name: 'Follow-up em 3 dias',
      trigger: { type: 'TASK_COMPLETED' },
      conditions: [],
      actions: [
        {
          type: 'CREATE_TASK',
          params: {
            title: 'Follow-up: o que aconteceu com este lead?',
            dueDateOffsetMinutes: 60 * 24 * 3,
          },
        },
      ],
      isActive: true,
    }),
  },
];

export default function AutomationTemplatesPage() {
  const router = useRouter();
  const [creating, setCreating] = useState<string | null>(null);

  const useTemplate = async (template: Template) => {
    setCreating(template.id);
    try {
      const payload = template.build();
      const res = await api.post('/automations', payload);
      toast.success(`Automação "${template.name}" criada`);
      router.push(`/settings/automations/${res.data.data.id}`);
    } catch {
      toast.error('Erro ao criar automação');
      setCreating(null);
    }
  };

  return (
    <div>
      <Link
        href="/settings/automations"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="size-3 mr-1" /> Voltar
      </Link>

      <h2 className="text-lg font-semibold mb-2">Templates de automação</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Comece a partir de um template pré-pronto. Você pode editar depois.
      </p>

      <div className="space-y-2">
        {TEMPLATES.map((t) => (
          <div key={t.id} className="rounded-lg border p-4 hover:bg-muted/20">
            <div className="flex items-start gap-3">
              <div className="shrink-0">{t.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>
              </div>
              <Button
                size="sm"
                onClick={() => useTemplate(t)}
                disabled={creating === t.id}
              >
                {creating === t.id ? 'Criando...' : 'Usar template'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
