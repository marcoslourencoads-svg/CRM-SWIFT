'use client';

import { ExternalLink, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  STAGE_META,
  cadenceDay,
  contactLink,
  daysOverdue,
  displayName,
  formatCompromisso,
  isOverdue,
  subtitleOf,
  type Prospect,
} from '@/lib/prospecting';

interface Props {
  prospect: Prospect;
  onClick?: () => void;
  showStage?: boolean;
  className?: string;
  actions?: React.ReactNode;
}

/**
 * Card de prospect. O negócio lidera o título e o nicho/canal/dia da
 * cadência formam o subtítulo — a mesma leitura de uma linha da
 * planilha, mas com a etapa explícita e o atraso visível.
 */
export function ProspectCard({ prospect, onClick, showStage, className, actions }: Props) {
  const atrasado = isOverdue(prospect);
  const atraso = daysOverdue(prospect);
  const link = contactLink(prospect);
  const stage = STAGE_META[prospect.stage];

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 transition-colors',
        onClick && 'cursor-pointer hover:border-foreground/20',
        atrasado && 'border-red-200 bg-red-50/40',
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{displayName(prospect)}</span>
            {prospect.hasAds && (
              <span
                title="Anuncia — qualificador de perfil"
                className="inline-flex shrink-0 items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700"
              >
                <Megaphone className="size-2.5" />
                Anuncia
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{subtitleOf(prospect)}</p>
        </div>

        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Abrir conversa"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {showStage && (
          <span
            className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', stage.badge)}
          >
            {stage.short}
          </span>
        )}

        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {prospect.touchCount} toque{prospect.touchCount === 1 ? '' : 's'}
        </span>

        {cadenceDay(prospect) && (
          <span
            title="Dias desde a abordagem"
            className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {cadenceDay(prospect)}
          </span>
        )}

        {atrasado ? (
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
            atrasado {atraso === 1 ? 'há 1 dia' : `há ${atraso} dias`} · era{' '}
            {formatCompromisso(prospect.nextActionAt)}
          </span>
        ) : prospect.nextActionAt ? (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
            {formatCompromisso(prospect.nextActionAt)}
          </span>
        ) : null}

        {prospect.leadId && (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
            virou lead
          </span>
        )}
      </div>

      {actions && (
        <div className="mt-2 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}
