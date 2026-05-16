'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { LeadCard, type Lead } from './lead-card';

interface Status {
  id: string;
  name: string;
  color: string;
  position: number;
  isWon?: boolean;
  isFinal?: boolean;
}

interface DroppableColumnProps {
  status: Status;
  leads: Lead[];
  onAddLead: (statusId: string) => void;
  onLeadClick?: (leadId: string) => void;
  onLeadChanged?: () => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelected?: (leadId: string) => void;
}

/**
 * Converte cor hex em rgba com alpha. Fallback pra cinza se inválido.
 */
function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(148, 163, 184, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function DroppableColumn({
  status,
  leads,
  onAddLead,
  onLeadClick,
  onLeadChanged,
  selectionMode,
  selectedIds,
  onToggleSelected,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  const totalValue = leads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);
  const color = status.color || '#94a3b8';
  const isWon = !!status.isWon;
  const isLost = !!status.isFinal && !status.isWon;

  return (
    <div
      className={cn(
        'flex w-72 flex-shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm',
        isWon && 'ring-1 ring-emerald-200',
        isLost && 'opacity-90',
      )}
    >
      {/* Faixa colorida no topo */}
      <div className="h-1 w-full" style={{ backgroundColor: color }} />

      {/* Column header */}
      <div
        className="flex items-center justify-between px-3 py-2.5"
        style={{ backgroundColor: hexToRgba(color, 0.08) }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="truncate text-sm font-semibold">{status.name}</span>
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: hexToRgba(color, 0.15), color }}
          >
            {leads.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 hover:bg-white/60"
          onClick={() => onAddLead(status.id)}
          title="Adicionar lead"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {totalValue > 0 && (
        <div
          className="border-b px-3 py-1 text-[11px] font-medium"
          style={{ color }}
        >
          {formatCurrency(totalValue)}
        </div>
      )}

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors',
          isOver && 'bg-emerald-50/60',
          isWon && !isOver && 'bg-emerald-50/30',
          isLost && !isOver && 'bg-zinc-50/60',
        )}
        style={{ minHeight: 200 }}
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              statusColor={color}
              onLeadClick={onLeadClick}
              onLeadChanged={onLeadChanged}
              selectionMode={selectionMode}
              selected={selectedIds?.has(lead.id)}
              onToggleSelected={onToggleSelected}
            />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <button
            type="button"
            onClick={() => onAddLead(status.id)}
            className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-muted-foreground/30 py-6 text-xs text-muted-foreground transition-colors hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-700"
          >
            <Plus className="size-3" /> Adicionar lead
          </button>
        )}
      </div>
    </div>
  );
}
