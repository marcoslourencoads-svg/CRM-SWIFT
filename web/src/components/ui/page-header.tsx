import { cn } from '@/lib/utils';

interface PageHeaderProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  count?: number | string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Header padronizado pra todas as páginas top-level.
 * Mantém alinhamento e tipografia consistente entre /dashboard, /leads,
 * /contacts, /activities, etc.
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  count,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="flex items-center gap-2 min-w-0">
        {Icon && (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <Icon className="size-4" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
            {count !== undefined && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {count}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
