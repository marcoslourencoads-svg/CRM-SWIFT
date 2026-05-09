'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, MoreVertical, Trash2, X, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LeadActionsMenuProps {
  onView?: () => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
  onDelete: () => void;
  triggerClassName?: string;
  align?: 'left' | 'right';
}

/**
 * Dropdown simples — botão "•••" com menu de ações do lead.
 * Sem dependência adicional (controlado por state local + click-outside).
 */
export function LeadActionsMenu({
  onView,
  onMarkWon,
  onMarkLost,
  onDelete,
  triggerClassName,
  align = 'right',
}: LeadActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const handle = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={ref} className="relative inline-block">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn('size-7', triggerClassName)}
        aria-label="Mais ações"
      >
        <MoreVertical className="size-4" />
      </Button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'absolute z-50 mt-1 min-w-[180px] rounded-md border bg-popover p-1 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {onView && (
            <button
              type="button"
              onClick={handle(onView)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Eye className="size-4" />
              Ver detalhes
            </button>
          )}
          <button
            type="button"
            onClick={handle(onMarkWon)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50"
          >
            <Trophy className="size-4" />
            Marcar como ganho
          </button>
          <button
            type="button"
            onClick={handle(onMarkLost)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-orange-600 hover:bg-orange-50"
          >
            <X className="size-4" />
            Marcar como perdido
          </button>
          <div className="my-1 border-t" />
          <button
            type="button"
            onClick={handle(onDelete)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="size-4" />
            Excluir lead
          </button>
        </div>
      )}
    </div>
  );
}
