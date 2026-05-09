'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { LeadCard, type Lead } from './lead-card';

interface Status {
  id: string;
  name: string;
  color: string;
  position: number;
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

  return (
    <div className="flex w-72 flex-shrink-0 flex-col rounded-lg bg-muted/50">
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: status.color || '#94a3b8' }}
          />
          <span className="text-sm font-semibold">{status.name}</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {leads.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onAddLead(status.id)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {totalValue > 0 && (
        <p className="px-3 pb-1 text-xs text-muted-foreground">
          {formatCurrency(totalValue)}
        </p>
      )}

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors ${
          isOver ? 'bg-accent/30' : ''
        }`}
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
              onLeadClick={onLeadClick}
              onLeadChanged={onLeadChanged}
              selectionMode={selectionMode}
              selected={selectedIds?.has(lead.id)}
              onToggleSelected={onToggleSelected}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
