'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bell } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LeadActionsMenu } from './lead-actions/lead-actions-menu';
import { MarkLostDialog } from './lead-actions/mark-lost-dialog';
import { MarkWonDialog } from './lead-actions/mark-won-dialog';
import { DeleteLeadDialog } from './lead-actions/delete-lead-dialog';

function customFieldDisplay(v: NonNullable<Lead['customFieldValues']>[number]) {
  switch (v.fieldDefinition.type) {
    case 'NUMBER':
    case 'CURRENCY':
    case 'PERCENTAGE':
    case 'RATING':
      return v.numberValue != null ? String(v.numberValue) : null;
    case 'CHECKBOX':
      return v.booleanValue ? 'Sim' : 'Não';
    case 'DATE':
    case 'DATETIME':
      return v.dateValue ? new Date(v.dateValue).toLocaleDateString('pt-BR') : null;
    case 'MULTI_SELECT':
      return Array.isArray(v.jsonValue) ? (v.jsonValue as string[]).join(', ') : null;
    default:
      return v.textValue;
  }
}

export interface Lead {
  id: string;
  title: string;
  estimatedValue: number;
  position: number;
  pipelineId?: string;
  version?: number;
  status: { id: string; name: string; color: string };
  assignee?: { id: string; name: string; avatarUrl?: string } | null;
  contact?: { name: string; email: string } | null;
  company?: { name: string } | null;
  tags?: { tag: { id: string; name: string; color: string } }[];
  customFieldValues?: {
    id: string;
    textValue: string | null;
    numberValue: number | null;
    dateValue: string | null;
    booleanValue: boolean | null;
    jsonValue: unknown;
    fieldDefinition: {
      id: string;
      name: string;
      type: string;
      isVisibleOnCard: boolean;
    };
  }[];
  tasks?: { id: string; dueDate: string | null }[];
}

interface LeadCardProps {
  lead: Lead;
  overlay?: boolean;
  onLeadClick?: (leadId: string) => void;
  onLeadChanged?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelected?: (leadId: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function LeadCard({
  lead,
  overlay,
  onLeadClick,
  onLeadChanged,
  selectionMode,
  selected,
  onToggleSelected,
}: LeadCardProps) {
  const [showLost, setShowLost] = useState(false);
  const [showWon, setShowWon] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, disabled: selectionMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...(selectionMode ? {} : attributes)}
        {...(selectionMode ? {} : listeners)}
        onClick={() => {
          if (selectionMode) {
            onToggleSelected?.(lead.id);
          } else {
            onLeadClick?.(lead.id);
          }
        }}
        className={cn(
          'group rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md relative',
          selectionMode ? 'cursor-pointer' : 'cursor-grab',
          isDragging && 'opacity-50',
          overlay && 'shadow-lg rotate-2',
          selected && 'ring-2 ring-primary ring-offset-1',
        )}
      >
        {selectionMode && (
          <div className="absolute top-2 right-2">
            <input
              type="checkbox"
              checked={!!selected}
              onChange={() => onToggleSelected?.(lead.id)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-border"
            />
          </div>
        )}
        <div className="flex items-start justify-between gap-1">
          <p className="text-sm font-medium leading-tight flex-1">{lead.title}</p>

          {lead.pipelineId && lead.version !== undefined && (
            <div
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <LeadActionsMenu
                onView={() => onLeadClick?.(lead.id)}
                onMarkWon={() => setShowWon(true)}
                onMarkLost={() => setShowLost(true)}
                onDelete={() => setShowDelete(true)}
                triggerClassName="size-6"
              />
            </div>
          )}
        </div>

        {lead.company?.name && (
          <p className="mt-1 text-xs text-muted-foreground">{lead.company.name}</p>
        )}

        {lead.tags && lead.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {lead.tags.slice(0, 3).map(({ tag }) => (
              <Badge
                key={tag.id}
                variant="outline"
                className="px-1.5 py-0 text-[10px] h-4"
                style={{ borderColor: tag.color, color: tag.color }}
              >
                {tag.name}
              </Badge>
            ))}
            {lead.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{lead.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {lead.customFieldValues && lead.customFieldValues.length > 0 && (
          <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
            {lead.customFieldValues.slice(0, 3).map((v) => {
              const display = customFieldDisplay(v);
              if (!display) return null;
              return (
                <p key={v.id} className="truncate">
                  <span className="font-medium">{v.fieldDefinition.name}:</span>{' '}
                  {display}
                </p>
              );
            })}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {lead.estimatedValue ? (
              <span className="text-xs font-semibold text-emerald-600">
                {formatCurrency(lead.estimatedValue)}
              </span>
            ) : null}

            {lead.tasks && lead.tasks.length > 0 && (() => {
              const overdue = lead.tasks.some(
                (t) => t.dueDate && new Date(t.dueDate) < new Date(),
              );
              return (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] font-semibold',
                    overdue
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700',
                  )}
                  title={
                    overdue
                      ? `${lead.tasks.length} tarefa(s) — alguma atrasada`
                      : `${lead.tasks.length} tarefa(s) pendente(s)`
                  }
                >
                  <Bell className="size-3" />
                  {lead.tasks.length}
                </span>
              );
            })()}
          </div>

          {lead.assignee && (
            <Avatar className="h-6 w-6">
              {lead.assignee.avatarUrl && (
                <AvatarImage src={lead.assignee.avatarUrl} alt={lead.assignee.name} />
              )}
              <AvatarFallback className="text-[10px]">
                {getInitials(lead.assignee.name)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>

      {lead.pipelineId && lead.version !== undefined && (
        <>
          <MarkLostDialog
            open={showLost}
            onOpenChange={setShowLost}
            leadId={lead.id}
            pipelineId={lead.pipelineId}
            leadVersion={lead.version}
            onSuccess={() => onLeadChanged?.()}
          />
          <MarkWonDialog
            open={showWon}
            onOpenChange={setShowWon}
            leadId={lead.id}
            pipelineId={lead.pipelineId}
            leadVersion={lead.version}
            currentEstimatedValue={lead.estimatedValue}
            onSuccess={() => onLeadChanged?.()}
          />
          <DeleteLeadDialog
            open={showDelete}
            onOpenChange={setShowDelete}
            leadId={lead.id}
            leadTitle={lead.title}
            onSuccess={() => onLeadChanged?.()}
          />
        </>
      )}
    </>
  );
}
