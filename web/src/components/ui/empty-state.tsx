import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Estado vazio padronizado.
 * Use sempre que uma listagem retorna 0 itens — substitui o "Sem dados..." cinza.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
  className,
}: EmptyStateProps) {
  const padding = {
    sm: 'p-6',
    md: 'p-10',
    lg: 'p-16',
  }[size];

  const iconSize = {
    sm: 'size-10',
    md: 'size-14',
    lg: 'size-20',
  }[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 text-center',
        padding,
        className,
      )}
    >
      <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-emerald-50">
        <Icon className={cn('text-emerald-600', iconSize)} />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
