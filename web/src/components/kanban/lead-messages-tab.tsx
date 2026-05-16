'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface ConversationWithMessages {
  id: string;
  contactName: string | null;
  contactPhone: string | null;
  status: string;
  lastMessageAt: string | null;
  channel: { id: string; name: string; type: string; provider: string };
}

interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string;
  status: string;
  createdAt: string;
}

interface Props {
  leadId: string;
}

export function LeadMessagesTab({ leadId }: Props) {
  const [conversations, setConversations] = useState<ConversationWithMessages[]>([]);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, Message[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inbox/conversations?limit=50');
      const list: ConversationWithMessages[] = (res.data.data ?? []).filter(
        (c: ConversationWithMessages & { leadId?: string }) => c['leadId'] === leadId,
      );
      setConversations(list);

      // carrega mensagens em paralelo
      const all = await Promise.all(
        list.map((c) =>
          api
            .get(`/inbox/conversations/${c.id}/messages?limit=100`)
            .then((r) => [c.id, r.data.data as Message[]] as const)
            .catch(() => [c.id, [] as Message[]] as const),
        ),
      );
      const map: Record<string, Message[]> = {};
      for (const [id, msgs] of all) map[id] = msgs;
      setMessagesByConv(map);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Skeleton className="h-40 w-full" />;

  if (conversations.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        <MessageSquare className="mx-auto mb-2 size-8 opacity-30" />
        Sem mensagens registradas pra esse lead.
        <br />
        Mande uma mensagem pelo botão WhatsApp pra começar.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {conversations.length} conversa{conversations.length > 1 ? 's' : ''}
        </p>
        <Link
          href="/inbox"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Abrir inbox <ExternalLink className="size-3" />
        </Link>
      </div>

      {conversations.map((conv) => {
        const msgs = messagesByConv[conv.id] ?? [];
        return (
          <div key={conv.id} className="rounded-lg border bg-card">
            <div className="border-b px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium">{conv.channel.name}</span>
              {conv.contactPhone && <> · {conv.contactPhone}</>}
              {conv.lastMessageAt && (
                <> · {format(new Date(conv.lastMessageAt), "dd/MM HH:mm", { locale: ptBR })}</>
              )}
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto p-3">
              {msgs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem mensagens.</p>
              ) : (
                msgs.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'flex',
                      m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start',
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                        m.direction === 'OUTBOUND'
                          ? 'bg-emerald-100 text-emerald-950'
                          : 'bg-muted',
                      )}
                    >
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className="mt-0.5 text-right text-[10px] text-muted-foreground">
                        {format(new Date(m.createdAt), 'HH:mm')}
                        {m.status === 'FAILED' && (
                          <span className="ml-1 text-red-600">· falhou</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
