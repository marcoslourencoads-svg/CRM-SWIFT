'use client';

import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;

interface SortableTableHeaderProps {
  label: string;
  sortKey: string;
  currentSortKey: string | null;
  currentDirection: SortDirection;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableTableHeader({
  label,
  sortKey,
  currentSortKey,
  currentDirection,
  onSort,
  className,
}: SortableTableHeaderProps) {
  const isActive = currentSortKey === sortKey;

  return (
    <TableHead
      className={cn('cursor-pointer select-none', className)}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive && currentDirection === 'asc' ? (
          <ArrowUp className="size-3.5" />
        ) : isActive && currentDirection === 'desc' ? (
          <ArrowDown className="size-3.5" />
        ) : (
          <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
        )}
      </div>
    </TableHead>
  );
}
