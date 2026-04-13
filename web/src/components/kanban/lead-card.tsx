'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatCurrency } from '@/lib/format';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface Lead {
  id: string;
  title: string;
  estimatedValue: number;
  position: number;
  status: { id: string; name: string; color: string };
  assignee?: { id: string; name: string; avatarUrl?: string } | null;
  contact?: { name: string; email: string } | null;
  company?: { name: string } | null;
}

interface LeadCardProps {
  lead: Lead;
  overlay?: boolean;
  onLeadClick?: (leadId: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function LeadCard({ lead, overlay, onLeadClick }: LeadCardProps) {
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
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onLeadClick?.(lead.id)}
      className={cn(
        'cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md',
        isDragging && 'opacity-50',
        overlay && 'shadow-lg rotate-2',
      )}
    >
      <p className="text-sm font-medium leading-tight">{lead.title}</p>

      {lead.company?.name && (
        <p className="mt-1 text-xs text-muted-foreground">{lead.company.name}</p>
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
  );
}
