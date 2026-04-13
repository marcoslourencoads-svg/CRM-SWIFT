'use client';

import { useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, UserPlus, ArrowRightCircle } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { SortableTableHeader, type SortDirection } from './table-header';

export interface Lead {
  id: string;
  title: string;
  estimatedValue: number;
  position: number;
  priority?: string | null;
  createdAt?: string | null;
  status: { id: string; name: string; color: string };
  assignee?: { id: string; name: string; avatarUrl?: string } | null;
  contact?: { name: string; email: string } | null;
  company?: { name: string } | null;
}

interface LeadsTableProps {
  leads: Lead[];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getPriorityLabel(priority: string | null | undefined): string {
  const map: Record<string, string> = {
    urgent: 'Urgente',
    high: 'Alta',
    medium: 'Media',
    low: 'Baixa',
  };
  return priority ? map[priority] || priority : '-';
}

function getPriorityColor(priority: string | null | undefined): string {
  const map: Record<string, string> = {
    urgent: 'bg-red-500/15 text-red-700 dark:text-red-400',
    high: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
    medium: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
    low: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  };
  return priority ? map[priority] || '' : '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

export function LeadsTable({ leads }: LeadsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const allSelected = leads.length > 0 && selectedIds.size === leads.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const sortedLeads = useMemo(() => {
    if (!sortKey || !sortDirection) return leads;

    return [...leads].sort((a, b) => {
      const aVal = getNestedValue(a as unknown as Record<string, unknown>, sortKey);
      const bVal = getNestedValue(b as unknown as Record<string, unknown>, sortKey);

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal), 'pt-BR');
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [leads, sortKey, sortDirection]);

  return (
    <div className="relative">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <SortableTableHeader
              label="Titulo"
              sortKey="title"
              currentSortKey={sortKey}
              currentDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHeader
              label="Empresa"
              sortKey="company.name"
              currentSortKey={sortKey}
              currentDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHeader
              label="Contato"
              sortKey="contact.name"
              currentSortKey={sortKey}
              currentDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHeader
              label="Valor"
              sortKey="estimatedValue"
              currentSortKey={sortKey}
              currentDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHeader
              label="Status"
              sortKey="status.name"
              currentSortKey={sortKey}
              currentDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHeader
              label="Responsavel"
              sortKey="assignee.name"
              currentSortKey={sortKey}
              currentDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHeader
              label="Prioridade"
              sortKey="priority"
              currentSortKey={sortKey}
              currentDirection={sortDirection}
              onSort={handleSort}
            />
            <SortableTableHeader
              label="Criado"
              sortKey="createdAt"
              currentSortKey={sortKey}
              currentDirection={sortDirection}
              onSort={handleSort}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedLeads.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                Nenhum lead encontrado.
              </TableCell>
            </TableRow>
          ) : (
            sortedLeads.map((lead) => (
              <TableRow
                key={lead.id}
                data-state={selectedIds.has(lead.id) ? 'selected' : undefined}
                className="cursor-pointer"
                onClick={() => console.log('Open lead detail:', lead.id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(lead.id)}
                    onCheckedChange={() => toggleSelect(lead.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{lead.title}</TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.company?.name || '-'}
                </TableCell>
                <TableCell>
                  <div>
                    <span className="text-sm">{lead.contact?.name || '-'}</span>
                    {lead.contact?.email && (
                      <p className="text-xs text-muted-foreground">{lead.contact.email}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-semibold text-emerald-600">
                  {lead.estimatedValue ? formatCurrency(lead.estimatedValue) : '-'}
                </TableCell>
                <TableCell>
                  <Badge
                    className="text-xs"
                    style={{
                      backgroundColor: `${lead.status.color}20`,
                      color: lead.status.color,
                      borderColor: `${lead.status.color}40`,
                    }}
                  >
                    {lead.status.name}
                  </Badge>
                </TableCell>
                <TableCell>
                  {lead.assignee ? (
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        {lead.assignee.avatarUrl && (
                          <AvatarImage src={lead.assignee.avatarUrl} alt={lead.assignee.name} />
                        )}
                        <AvatarFallback>{getInitials(lead.assignee.name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{lead.assignee.name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {lead.priority ? (
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${getPriorityColor(lead.priority)}`}
                    >
                      {getPriorityLabel(lead.priority)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {lead.createdAt
                    ? formatDistanceToNow(new Date(lead.createdAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })
                    : '-'}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 mx-auto mt-4 flex w-fit items-center gap-3 rounded-lg border bg-card px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className="h-4 w-px bg-border" />
          <Button variant="outline" size="sm" onClick={() => console.log('Move to...', [...selectedIds])}>
            <ArrowRightCircle className="mr-1.5 size-4" />
            Mover para...
          </Button>
          <Button variant="outline" size="sm" onClick={() => console.log('Assign to...', [...selectedIds])}>
            <UserPlus className="mr-1.5 size-4" />
            Atribuir a...
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => console.log('Delete', [...selectedIds])}>
            <Trash2 className="mr-1.5 size-4" />
            Excluir
          </Button>
        </div>
      )}
    </div>
  );
}
