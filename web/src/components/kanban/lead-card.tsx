'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatCurrency } from '@/lib/format';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LeadActionsMenu } from './lead-actions/lead-actions-menu';
import { MarkLostDialog } from './lead-actions/mark-lost-dialog';
import { MarkWonDialog } from './lead-actions/mark-won-dialog';
import { DeleteLeadDialog } from './lead-actions/delete-lead-dialog';

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
}

interface LeadCardProps {
  lead: Lead;
  overlay?: boolean;
  onLeadClick?: (leadId: string) => void;
  onLeadChanged?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function LeadCard({ lead, overlay, onLeadClick, onLeadChanged }: LeadCardProps) {
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
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => onLeadClick?.(lead.id)}
        className={cn(
          'group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md relative',
          isDragging && 'opacity-50',
          overlay && 'shadow-lg rotate-2',
        )}
      >
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

        <div className="mt-2 flex items-center justify-between">
          {lead.estimatedValue ? (
            <span className="text-xs font-semibold text-emerald-600">
              {formatCurrency(lead.estimatedValue)}
            </span>
          ) : (
            <span />
          )}

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
