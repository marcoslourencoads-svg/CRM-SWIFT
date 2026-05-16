'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';

interface AutomationLog {
  id: string;
  ruleId: string;
  leadId: string;
  status: string;
  executedActions: { type: string; params: unknown; result: string }[];
  error: string | null;
  executionTimeMs: number | null;
  createdAt: string;
}

export default function AutomationLogsPage() {
  const params = useParams<{ id: string }>();
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/automations/${params.id}/logs?limit=100`);
      setLogs(res.data.data ?? []);
    } catch {
      toast.error('Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <Link
        href={`/settings/automations/${params.id}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="size-3 mr-1" /> Voltar
      </Link>

      <h2 className="text-lg font-semibold mb-2">Logs de execução</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Toda vez que a automação é disparada, fica registrado aqui com sucesso/falha e tempo de execução.
      </p>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : logs.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-12 text-center text-sm text-muted-foreground">
          Sem execuções ainda. Dispare o trigger pra ver logs aqui.
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {l.status === 'SUCCESS' ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Sucesso</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Falhou</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(l.createdAt), "dd/MM HH:mm:ss", { locale: ptBR })}
                    </span>
                    {l.executionTimeMs != null && (
                      <span className="text-xs text-muted-foreground">· {l.executionTimeMs}ms</span>
                    )}
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    Lead: {l.leadId}
                  </div>

                  {l.executedActions?.length > 0 && (
                    <ul className="mt-2 ml-4 list-disc space-y-0.5 text-xs">
                      {l.executedActions.map((a, i) => (
                        <li key={i}>
                          <span className="font-medium">{a.type}</span>: {a.result}
                        </li>
                      ))}
                    </ul>
                  )}

                  {l.error && (
                    <pre className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">{l.error}</pre>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
