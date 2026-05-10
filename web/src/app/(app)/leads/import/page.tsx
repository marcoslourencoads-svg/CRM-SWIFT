'use client';

import { useEffect, useState } from 'react';
import { Upload, FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';

interface Pipeline {
  id: string;
  name: string;
}

export default function ImportLeadsPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineId, setPipelineId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created?: number; errors?: number; duplicates?: number } | null>(null);

  useEffect(() => {
    api.get('/pipelines').then((res) => {
      const list: Pipeline[] = res.data.data ?? [];
      setPipelines(list);
      if (list.length > 0) setPipelineId(list[0].id);
    });
  }, []);

  const submit = async () => {
    if (!file) return toast.error('Selecione um arquivo CSV');
    if (!pipelineId) return toast.error('Selecione um pipeline');

    setSubmitting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post(`/leads/import?pipelineId=${pipelineId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data.data ?? res.data);
      toast.success('Importação concluída');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? 'Erro ao importar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="size-3 mr-1" /> Voltar
      </Link>

      <h1 className="text-2xl font-bold mb-2">Importar leads de CSV</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Suba uma planilha CSV pra criar vários leads de uma vez. O arquivo precisa ter pelo menos a coluna <strong>title</strong>. Outras colunas reconhecidas: <code>contactName</code>, <code>contactEmail</code>, <code>contactPhone</code>, <code>companyName</code>, <code>estimatedValue</code>, <code>priority</code>, <code>temperature</code>.
      </p>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="space-y-1">
          <Label>Pipeline destino</Label>
          <Select value={pipelineId} onValueChange={(v) => setPipelineId(v ?? '')}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Arquivo CSV</Label>
          <div className="rounded-md border-2 border-dashed border-border p-6 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
              id="csv-input"
            />
            <label htmlFor="csv-input" className="cursor-pointer flex flex-col items-center gap-2">
              {file ? (
                <>
                  <FileText className="size-8 text-emerald-600" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                </>
              ) : (
                <>
                  <Upload className="size-8 text-muted-foreground" />
                  <span className="text-sm">Clique pra selecionar o CSV</span>
                </>
              )}
            </label>
          </div>
        </div>

        <Button onClick={submit} disabled={!file || !pipelineId || submitting} className="w-full">
          {submitting ? 'Importando...' : 'Importar leads'}
        </Button>
      </div>

      {result && (
        <div className="mt-4 rounded-lg border bg-emerald-50 p-4">
          <p className="font-semibold text-emerald-900">Resultado da importação</p>
          <ul className="mt-2 text-sm text-emerald-800 space-y-1">
            <li>✓ Criados: {result.created ?? 0}</li>
            {result.duplicates !== undefined && <li>⚠️ Duplicatas ignoradas: {result.duplicates}</li>}
            {result.errors !== undefined && result.errors > 0 && (
              <li>❌ Erros: {result.errors}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
