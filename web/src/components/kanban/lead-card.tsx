'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bell, Clock, Phone, Mail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  lastActivityAt?: string | null;
  status: { id: string; name: string; color: string };
  assignee?: { id: string; name: string; avatarUrl?: string } | null;
  contact?: { name: string; email: string | null; phone?: string | null } | null;
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
  score?: { score: number } | null;
}

interface LeadCardProps {
  lead: Lead;
  statusColor?: string;
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

function staleLevel(lastActivityAt: string | null | undefined): 'fresh' | 'warm' | 'stale' {
  if (!lastActivityAt) return 'fresh';
  const days = (Date.now() - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24);
  if (days > 10) return 'stale';
  if (days > 5) return 'warm';
  return 'fresh';
}

function sanitizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function LeadCard({
  lead,
  statusColor,
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

  const stale = staleLevel(lead.lastActivityAt);
  const accent = statusColor ?? lead.status.color ?? '#94a3b8';

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
          'group relative overflow-hidden rounded-lg border bg-white shadow-sm transition-all hover:-translate-y-px hover:shadow-md',
          selectionMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
          isDragging && 'opacity-50',
          overlay && 'shadow-xl rotate-1',
          selected && 'ring-2 ring-emerald-500 ring-offset-1',
          stale === 'warm' && 'ring-1 ring-amber-300',
          stale === 'stale' && 'ring-1 ring-red-300',
        )}
      >
        {/* Faixa colorida no topo */}
        <div className="h-1 w-full" style={{ backgroundColor: accent }} />

        <div className="p-3">
          {selectionMode && (
            <div className="absolute right-2 top-3">
              <input
                type="checkbox"
                checked={!!selected}
                onChange={() => onToggleSelected?.(lead.id)}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 rounded border-border"
              />
            </div>
          )}

          {/* Header: score + título */}
          <div className="flex items-start justify-between gap-1">
            <div className="flex min-w-0 flex-1 items-start gap-1.5">
              {lead.score && lead.score.score > 0 && (
                <span
                  className={cn(
                    'mt-0.5 inline-flex h-[18px] min-w-[24px] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                    lead.score.score >= 61
                      ? 'bg-emerald-100 text-emerald-700'
                      : lead.score.score >= 31
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-zinc-100 text-zinc-600',
                  )}
                  title={`Score: ${lead.score.score}`}
                >
                  {lead.score.score}
                </span>
              )}
              <p className="flex-1 text-sm font-semibold leading-tight">{lead.title}</p>
            </div>

            {lead.pipelineId && lead.version !== undefined && (
              <div
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
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

          {/* Contato (nome + ações rápidas se tiver telefone/email) */}
          {(lead.contact?.name || lead.company?.name) && (
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="truncate text-xs text-muted-foreground">
                {lead.contact?.name && <span>{lead.contact.name}</span>}
                {lead.contact?.name && lead.company?.name && <span> · </span>}
                {lead.company?.name && <span>{lead.company.name}</span>}
              </p>
              <div
                className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                {lead.contact?.phone && (
                  <a
                    href={`https://wa.me/${sanitizePhone(lead.contact.phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Abrir WhatsApp"
                    className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                  >
                    <Phone className="size-3" />
                  </a>
                )}
                {lead.contact?.email && (
                  <a
                    href={`mailto:${lead.contact.email}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Enviar email"
                    className="rounded p-1 text-blue-600 hover:bg-blue-50"
                  >
                    <Mail className="size-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {lead.tags && lead.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {lead.tags.slice(0, 3).map(({ tag }) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="h-4 px-1.5 py-0 text-[10px]"
                  style={{ borderColor: tag.color, color: tag.color }}
                >
                  {tag.name}
                </Badge>
              ))}
              {lead.tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{lead.tags.length - 3}</span>
              )}
            </div>
          )}

          {/* Custom fields */}
          {lead.customFieldValues && lead.customFieldValues.length > 0 && (
            <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
              {lead.customFieldValues.slice(0, 3).map((v) => {
                const display = customFieldDisplay(v);
                if (!display) return null;
                return (
                  <p key={v.id} className="truncate">
                    <span className="font-medium">{v.fieldDefinition.name}:</span> {display}
                  </p>
                );
              })}
            </div>
          )}

          {/* Footer: valor + tasks + assignee */}
          <div className="mt-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {lead.estimatedValue ? (
                <span className="text-xs font-bold text-emerald-600">
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
                      overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
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

              {(stale === 'warm' || stale === 'stale') && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] font-semibold',
                    stale === 'stale' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
                  )}
                  title={`Lead parado há ${formatDistanceToNow(new Date(lead.lastActivityAt!), { locale: ptBR })}`}
                >
                  <Clock className="size-3" />
                </span>
              )}
            </div>

            {lead.assignee && (
              <Avatar className="h-6 w-6" title={lead.assignee.name}>
                {lead.assignee.avatarUrl && (
                  <AvatarImage src={lead.assignee.avatarUrl} alt={lead.assignee.name} />
                )}
                <AvatarFallback className="bg-emerald-100 text-[10px] text-emerald-700">
                  {getInitials(lead.assignee.name)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          {/* Última atividade (timestamp humanizado) */}
          {lead.lastActivityAt && (
            <p className="mt-1.5 text-[10px] text-muted-foreground/70">
              Atualizado{' '}
              {formatDistanceToNow(new Date(lead.lastActivityAt), {
                addSuffix: true,
                locale: ptBR,
              })}
            </p>
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
