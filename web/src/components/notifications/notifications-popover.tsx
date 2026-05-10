'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

const TYPE_LABELS: Record<string, string> = {
  LEAD_ASSIGNED: 'Lead atribuído',
  STATUS_CHANGED: 'Status alterado',
  NOTE_ADDED: 'Nota adicionada',
  MENTION: 'Menção',
  TASK_DUE: 'Tarefa vencendo',
  LEAD_STALE: 'Lead parado',
  INVITE: 'Convite',
  AUTOMATION: 'Automação',
  LEAD_WON: 'Lead ganho',
};

export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnread(data.data?.count ?? 0);
    } catch {
      // silent
    }
  }, []);

  const fetchList = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications?limit=20');
      setItems(data.data ?? []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();

    // Tenta conexão SSE real-time. Se falhar, mantém polling como fallback.
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';

    if (!token) {
      const interval = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(interval);
    }

    const es = new EventSource(`${apiUrl}/notifications/stream?token=${encodeURIComponent(token)}`);

    es.addEventListener('notification.created', () => {
      // refresh tanto o contador quanto a lista (se popover estiver aberto)
      fetchUnreadCount();
      if (open) fetchList();
    });

    es.addEventListener('connected', () => {
      // SSE ativo — poderia desativar polling, mas mantemos refresh a cada 5min como safety net
    });

    es.onerror = () => {
      // Em caso de erro, o browser tenta reconectar automaticamente.
      // Não fechamos a conexão aqui.
    };

    const safetyRefresh = setInterval(fetchUnreadCount, 5 * 60 * 1000);

    return () => {
      es.close();
      clearInterval(safetyRefresh);
    };
  }, [fetchUnreadCount, fetchList, open]);

  useEffect(() => {
    if (open) {
      fetchList();
    }
  }, [open, fetchList]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      fetchUnreadCount();
    } catch {
      // silent
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    } catch {
      // silent
    }
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 relative"
        onClick={() => setOpen((v) => !v)}
        title="Notificações"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-semibold">Notificações</p>
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                className="h-6 text-xs"
              >
                <CheckCheck className="mr-1 size-3" />
                Marcar todas
              </Button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma notificação ainda.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.isRead && markRead(n.id)}
                  className={cn(
                    'flex w-full items-start gap-2 border-b px-3 py-2 text-left hover:bg-muted/50 last:border-b-0',
                    !n.isRead && 'bg-blue-50/50',
                  )}
                >
                  <div className="mt-1 flex size-2 shrink-0 items-center justify-center">
                    {!n.isRead && (
                      <span className="size-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">
                      {TYPE_LABELS[n.type] ?? n.type}
                    </p>
                    <p className="text-sm">{n.title}</p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {n.body}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  {!n.isRead && (
                    <Check className="mt-1 size-3 text-muted-foreground shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
