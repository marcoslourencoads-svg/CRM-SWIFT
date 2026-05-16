'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Send,
  Hash,
  Lock,
  User as UserIcon,
  Plus,
  Users,
  MessageSquare,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
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

interface ChannelItem {
  id: string;
  name: string;
  type: 'PUBLIC' | 'PRIVATE' | 'DIRECT';
  description: string | null;
  memberCount: number;
  messageCount: number;
  lastMessage: { id: string; body: string; authorId: string; createdAt: string } | null;
  hasUnread: boolean;
}

interface Message {
  id: string;
  channelId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
}

function formatTime(d: Date) {
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Ontem ' + format(d, 'HH:mm');
  return format(d, 'dd/MM HH:mm', { locale: ptBR });
}

export default function TeamChatPage() {
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [creating, setCreating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadChannels = useCallback(async () => {
    try {
      const res = await api.get('/team-chat/channels');
      const list: ChannelItem[] = res.data.data ?? [];
      setChannels(list);
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id);
      }
    } catch {
      toast.error('Erro ao carregar canais');
    } finally {
      setLoadingChannels(false);
    }
  }, [selectedId]);

  const loadMessages = useCallback(async (id: string) => {
    setLoadingMessages(true);
    try {
      const res = await api.get(`/team-chat/channels/${id}/messages`);
      setMessages(res.data.data ?? []);
      await api.post(`/team-chat/channels/${id}/read`).catch(() => {});
    } catch {
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);
  useEffect(() => {
    api.get('/members').then((r) => setMembers(r.data.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  // SSE
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
    if (!token) return;

    const es = new EventSource(
      `${apiUrl}/team-chat/stream?token=${encodeURIComponent(token)}`,
    );

    es.addEventListener('message.created', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        if (data.channelId === selectedId) {
          setMessages((prev) => [...prev, data.message]);
        }
        loadChannels();
      } catch {}
    });

    es.onerror = () => {};
    return () => es.close();
  }, [selectedId, loadChannels]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selected = channels.find((c) => c.id === selectedId) ?? null;

  const send = async () => {
    if (!selected || !draft.trim()) return;
    setSending(true);
    try {
      await api.post(`/team-chat/channels/${selected.id}/messages`, { body: draft.trim() });
      setDraft('');
    } catch {
      toast.error('Falha ao enviar');
    } finally {
      setSending(false);
    }
  };

  const createChannel = async () => {
    if (!newName.trim()) return toast.error('Nome obrigatório');
    setCreating(true);
    try {
      const res = await api.post('/team-chat/channels', {
        name: newName.trim().toLowerCase().replace(/\s+/g, '-'),
        type: newType,
        description: newDesc.trim() || undefined,
      });
      toast.success('Canal criado');
      setNewOpen(false);
      setNewName('');
      setNewDesc('');
      await loadChannels();
      setSelectedId(res.data.data.id);
    } catch {
      toast.error('Erro ao criar canal');
    } finally {
      setCreating(false);
    }
  };

  const authorName = (id: string) =>
    members.find((m) => m.id === id)?.name ?? 'Usuário';

  return (
    <div className="-m-6 flex h-[calc(100vh-0px)] overflow-hidden">
      {/* Sidebar com canais */}
      <aside className="flex w-72 shrink-0 flex-col border-r bg-card">
        <div className="flex items-center justify-between border-b p-3">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Users className="size-5 text-emerald-600" /> Chat do Time
          </h1>
          <Button variant="outline" size="icon-sm" onClick={() => setNewOpen(true)} title="Novo canal">
            <Plus className="size-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loadingChannels ? (
            <div className="space-y-1">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : channels.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              Sem canais ainda. Crie o primeiro.
            </p>
          ) : (
            channels.map((c) => {
              const Icon = c.type === 'PUBLIC' ? Hash : c.type === 'PRIVATE' ? Lock : UserIcon;
              const isActive = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/50',
                    isActive && 'bg-accent font-medium',
                    c.hasUnread && !isActive && 'font-semibold',
                  )}
                >
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{c.name}</span>
                  {c.hasUnread && !isActive && (
                    <span className="size-2 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Chat */}
      <section className="flex flex-1 flex-col bg-muted/10">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="mb-3 size-12 opacity-30" />
            <p className="text-sm">Selecione um canal pra começar</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b bg-card px-4 py-3">
              {selected.type === 'PUBLIC' ? (
                <Hash className="size-4 text-muted-foreground" />
              ) : (
                <Lock className="size-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-semibold">{selected.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {selected.memberCount} membro{selected.memberCount > 1 ? 's' : ''}
                  {selected.description && <> · {selected.description}</>}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingMessages ? (
                <Skeleton className="h-24 w-2/3" />
              ) : messages.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground">
                  Manda a primeira mensagem desse canal.
                </p>
              ) : (
                <div className="space-y-3">
                  {messages.map((m, idx) => {
                    const prev = messages[idx - 1];
                    const showAuthor =
                      !prev ||
                      prev.authorId !== m.authorId ||
                      new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;
                    return (
                      <div key={m.id} className="flex gap-2">
                        {showAuthor ? (
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-xs font-semibold text-emerald-700">
                            {authorName(m.authorId).slice(0, 2).toUpperCase()}
                          </div>
                        ) : (
                          <div className="w-8 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          {showAuthor && (
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-semibold">{authorName(m.authorId)}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatTime(new Date(m.createdAt))}
                              </span>
                            </div>
                          )}
                          <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

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
                  placeholder={`Mensagem em #${selected.name}`}
                  rows={2}
                  className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button type="submit" disabled={sending || !draft.trim()} size="icon">
                  <Send className="size-4" />
                </Button>
              </form>
            </div>
          </>
        )}
      </section>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo canal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ex: vendas, marketing, geral..."
              />
            </div>
            <div className="space-y-1">
              <Label>Descrição (opcional)</Label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Pro que serve esse canal"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNewType('PUBLIC')}
                className={cn(
                  'flex-1 rounded-md border p-3 text-left text-xs transition-colors',
                  newType === 'PUBLIC' ? 'border-emerald-500 bg-emerald-50' : 'hover:bg-muted/50',
                )}
              >
                <Hash className="mb-1 size-4" />
                <p className="font-semibold">Público</p>
                <p className="text-muted-foreground">Todos do time veem</p>
              </button>
              <button
                type="button"
                onClick={() => setNewType('PRIVATE')}
                className={cn(
                  'flex-1 rounded-md border p-3 text-left text-xs transition-colors',
                  newType === 'PRIVATE' ? 'border-emerald-500 bg-emerald-50' : 'hover:bg-muted/50',
                )}
              >
                <Lock className="mb-1 size-4" />
                <p className="font-semibold">Privado</p>
                <p className="text-muted-foreground">Só membros convidados</p>
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={createChannel} disabled={creating}>
              {creating ? 'Criando...' : 'Criar canal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
