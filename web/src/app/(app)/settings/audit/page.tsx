'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';

const TYPE_LABELS: Record<string, string> = {
  CREATED: 'Lead criado',
  STATUS_CHANGED: 'Status mudou',
  ASSIGNED: 'Atribuído',
  FIELD_UPDATED: 'Campo editado',
  CUSTOM_FIELD_UPDATED: 'Campo custom',
  TAG_ADDED: 'Tag adicionada',
  TAG_REMOVED: 'Tag removida',
  NOTE_ADDED: 'Nota adicionada',
  ATTACHMENT_ADDED: 'Anexo',
  PIPELINE_MOVED: 'Pipeline mudou',
  LEAD_WON: 'Lead ganho',
  LEAD_LOST: 'Lead perdido',
  AUTOMATION_FIRED: 'Automação',
};

interface ActivityRow {
  id: string;
  type: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  user: { id: string; name: string } | null;
  lead: { id: string; title: string };
}

interface Member {
  id: string;
  name: string;
  email: string;
}

export default function AuditPage() {
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterUserId, setFilterUserId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterUserId) params.set('userId', filterUserId);
      if (filterType) params.set('type', filterType);
      if (filterFrom) params.set('dateFrom', new Date(filterFrom).toISOString());
      if (filterTo) params.set('dateTo', new Date(filterTo).toISOString());
      params.set('limit', '100');

      const res = await api.get('/activities?' + params.toString());
      setItems(res.data.data ?? []);
    } catch {
      toast.error('Erro ao carregar audit log');
    } finally {
      setLoading(false);
    }
  }, [filterUserId, filterType, filterFrom, filterTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    api.get('/members').then((r) => setMembers(r.data.data ?? [])).catch(() => {});
  }, []);

  const exportCsv = () => {
    const rows = [
      ['Data', 'Tipo', 'Usuário', 'Lead', 'Metadata'].join(','),
      ...items.map((a) =>
        [
          new Date(a.createdAt).toISOString(),
          TYPE_LABELS[a.type] ?? a.type,
          a.user?.name ?? '(sistema)',
          a.lead.title.replace(/,/g, ';'),
          JSON.stringify(a.metadata).replace(/,/g, ';'),
        ].join(','),
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Audit log</h2>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={items.length === 0}>
          <Download className="mr-1 size-3" />
          Exportar CSV
        </Button>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Histórico de tudo que aconteceu na sua organização. Útil pra auditoria e descobrir quem fez o quê.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Usuário</Label>
          <Select value={filterUserId} onValueChange={(v) => setFilterUserId(v ?? '')}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={filterType} onValueChange={(v) => setFilterType(v ?? '')}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">De</Label>
          <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="h-8" />
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-12 text-center text-sm text-muted-foreground">
          <Filter className="mx-auto mb-2 size-5" />
          Nenhuma atividade no período selecionado.
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2 text-left font-medium">Data</th>
                <th className="px-3 py-2 text-left font-medium">Tipo</th>
                <th className="px-3 py-2 text-left font-medium">Usuário</th>
                <th className="px-3 py-2 text-left font-medium">Lead</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {format(new Date(a.createdAt), 'dd/MM HH:mm', { locale: ptBR })}
                  </td>
                  <td className="px-3 py-2">{TYPE_LABELS[a.type] ?? a.type}</td>
                  <td className="px-3 py-2">{a.user?.name ?? '(sistema)'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{a.lead.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
