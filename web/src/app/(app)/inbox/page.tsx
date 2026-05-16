'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Search, MessageSquare, Phone, User as UserIcon } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface ConversationListItem {
  id: string;
  channelId: string;
  leadId: string | null;
  contactPhone: string | null;
  contactName: string | null;
  status: 'OPEN' | 'CLOSED' | 'ARCHIVED';
  lastMessageAt: string | null;
  unreadCount: number;
  channel: { id: string; name: string; type: string; provider: string };
  messages: { id: string; body: string; direction: 'INBOUND' | 'OUTBOUND'; createdAt: string }[];
}

interface Message {
  id: string;
  conversationId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string;
  status: string;
  createdAt: string;
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await api.get(`/inbox/conversations?${params}`);
      setConversations(res.data.data ?? []);
    } catch {
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoadingList(false);
    }
  }, [search]);

  const loadMessages = useCallback(async (id: string) => {
    setLoadingMessages(true);
    try {
      const res = await api.get(`/inbox/conversations/${id}/messages`);
      setMessages(res.data.data ?? []);
      // marca como lida
      await api.post(`/inbox/conversations/${id}/read`).catch(() => {});
    } catch {
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  // SSE real-time
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
    if (!token) return;

    const es = new EventSource(
      `${apiUrl}/inbox/stream?token=${encodeURIComponent(token)}`,
    );

    es.addEventListener('message.created', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        // Se for da conversa aberta, append
        if (data.conversationId === selectedId) {
          setMessages((prev) => [...prev, data.message]);
        }
        // Atualiza a lista sempre
        loadConversations();
      } catch {
        // silent
      }
    });

    es.addEventListener('conversation.created', () => loadConversations());
    es.addEventListener('conversation.updated', () => loadConversations());

    es.onerror = () => { /* auto-reconnect */ };

    return () => es.close();
  }, [selectedId, loadConversations]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const send = async () => {
    if (!selected || !draft.trim()) return;
    setSending(true);
    try {
      await api.post('/inbox/messages', {
        channelId: selected.channelId,
        body: draft.trim(),
        leadId: selected.leadId ?? undefined,
        contactPhone: selected.contactPhone ?? undefined,
        contactName: selected.contactName ?? undefined,
      });
      setDraft('');
      // SSE vai disparar refresh; mas pra UX rápido recarrega já
      loadMessages(selected.id);
    } catch {
      toast.error('Falha ao enviar');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="-m-6 flex h-[calc(100vh-0px)] overflow-hidden">
      {/* Coluna esquerda: lista de conversas */}
      <aside className="flex w-80 shrink-0 flex-col border-r bg-card">
        <div className="border-b p-3">
          <h1 className="mb-2 text-lg font-semibold">Inbox</h1>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              className="h-8 pl-7 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="space-y-1 p-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Sem conversas ainda.
              <br />
              <br />
              Quando você mandar uma mensagem WhatsApp pelo CRM, ela aparece aqui.
            </div>
          ) : (
            conversations.map((c) => {
              const last = c.messages[0];
              const title = c.contactName || c.contactPhone || 'Sem nome';
              const isActive = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    'flex w-full items-start gap-2 border-b px-3 py-2.5 text-left transition-colors hover:bg-accent/50',
                    isActive && 'bg-accent',
                  )}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <UserIcon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{title}</p>
                      {c.lastMessageAt && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(c.lastMessageAt), {
                            addSuffix: false,
                            locale: ptBR,
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-muted-foreground">
                        {last
                          ? `${last.direction === 'OUTBOUND' ? 'Você: ' : ''}${last.body}`
                          : 'Sem mensagens'}
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Coluna direita: chat */}
      <section className="flex flex-1 flex-col bg-muted/10">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="mb-3 size-12 opacity-30" />
            <p className="text-sm">Selecione uma conversa pra começar</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b bg-card px-4 py-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                <UserIcon className="size-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">
                  {selected.contactName || selected.contactPhone || 'Sem nome'}
                </p>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  {selected.contactPhone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3" /> {selected.contactPhone}
                    </span>
                  )}
                  <span className="text-[10px]">· {selected.channel.name}</span>
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingMessages ? (
                <Skeleton className="h-24 w-2/3" />
              ) : messages.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground">
                  Nenhuma mensagem ainda. Manda a primeira aqui embaixo.
                </p>
              ) : (
                <div className="space-y-2">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        'flex',
                        m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start',
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[70%] rounded-lg px-3 py-2 text-sm shadow-sm',
                          m.direction === 'OUTBOUND'
                            ? 'bg-emerald-100 text-emerald-950'
                            : 'bg-white text-foreground',
                        )}
                      >
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p className="mt-0.5 text-right text-[10px] text-muted-foreground">
                          {format(new Date(m.createdAt), 'HH:mm')}
                          {m.direction === 'OUTBOUND' && m.status === 'FAILED' && (
                            <span className="ml-1 text-red-600">· falhou</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t bg-card p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Digite uma mensagem... (Enter pra enviar, Shift+Enter pra nova linha)"
                  rows={2}
                  className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button type="submit" disabled={sending || !draft.trim()} size="icon">
                  <Send className="size-4" />
                </Button>
              </form>
              {selected.channel.provider === 'MANUAL' && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Canal manual: a mensagem fica registrada aqui. Pra disparar via WhatsApp real,
                  configure um provider em Configurações → Canais.
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
