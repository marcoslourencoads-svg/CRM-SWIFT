'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, CheckCircle2, FileUp, Upload } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ProspectList } from '@/lib/prospecting';

interface ImportResult {
  imported: number;
  skipped: number;
  touchesCreated: number;
  errors: { row: number; message: string }[];
  avisos: string[];
}

// As colunas da planilha antiga e onde cada uma cai no CRM. Serve de
// documentação viva para quem for exportar o arquivo.
const MAPPING: [string, string][] = [
  ['Link do Instagram', 'Perfil e @ do prospect'],
  ['Tem Anuncio?', 'Qualificador "anuncia" (vira corte no funil)'],
  ['Data da mensagem', 'Toque 1 — a abordagem'],
  ['Principal abordagem', 'Script usado (vira catálogo de abordagens)'],
  ['Data do FUP 1/2/3 + FEZ FUP?', 'Toques 2, 3 e 4 — cadência ilimitada daqui em diante'],
  ['RESPONDEU?', 'Carimbo de resposta + etapa'],
  ['Agendou reunião? / Fez reunião?', 'Reunião agendada e realizada (gera a taxa de no-show)'],
  ['Fechou Contrato? / Valor', 'Fechamento e receita'],
  ['Se não fechou, qual motivo?', 'Observação da perda'],
];

export default function ProspectingImportPage() {
  const [lists, setLists] = useState<ProspectList[]>([]);
  const [listId, setListId] = useState('none');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get('/prospect-lists')
      .then((res) => setLists(res.data.data ?? []))
      .catch(() => {});
  }, []);

  async function handleUpload() {
    if (!file) {
      toast.error('Escolha um arquivo CSV');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setResult(null);
    try {
      const query = listId !== 'none' ? `?listId=${listId}` : '';
      const res = await api.post(`/prospects/import${query}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data.data);
      toast.success(`${res.data.data.imported} prospects importados`);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'Não foi possível importar';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Upload}
        title="Importar planilha"
        description="Traz a prospecção que estava no Google Sheets, com os follow-ups"
        actions={
          <Link
            href="/prospecting"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <ArrowLeft className="mr-1 size-3.5" />
            Voltar para a fila
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Arquivo CSV</CardTitle>
            <p className="text-xs text-muted-foreground">
              Exporte a aba de prospecções como CSV. Os cabeçalhos originais são
              reconhecidos automaticamente, com acento e maiúsculas.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors',
                file ? 'border-emerald-300 bg-emerald-50/40' : 'hover:border-foreground/20',
              )}
              onClick={() => inputRef.current?.click()}
            >
              <FileUp
                className={cn('size-8', file ? 'text-emerald-600' : 'text-muted-foreground')}
              />
              <p className="mt-2 text-sm font-medium">
                {file ? file.name : 'Clique para escolher o CSV'}
              </p>
              <p className="text-xs text-muted-foreground">
                {file
                  ? `${(file.size / 1024).toFixed(0)} KB`
                  : 'Até 10 MB'}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setResult(null);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Adicionar a uma lista</Label>
              <Select value={listId} onValueChange={(v) => setListId(v ?? 'none')}>
                <SelectTrigger>
                  <SelectValue>
                    {listId === 'none'
                      ? 'Sem lista'
                      : (lists.find((l) => l.id === listId)?.name ?? 'Lista')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem lista</SelectItem>
                  {lists.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} (cadência {l.cadenceDays.join(', ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A cadência da lista passa a valer para os próximos toques destes
                prospects.
              </p>
            </div>

            <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
              {uploading ? 'Importando...' : 'Importar'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">O que vira o quê</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-xs">
              {MAPPING.map(([from, to]) => (
                <div key={from}>
                  <dt className="font-medium">{from}</dt>
                  <dd className="text-muted-foreground">→ {to}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Importação concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Prospects importados" value={result.imported} />
              <Stat label="Toques reconstruídos" value={result.touchesCreated} />
              <Stat label="Linhas ignoradas" value={result.skipped} />
            </div>

            {result.avisos.map((aviso) => (
              <div
                key={aviso}
                className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>{aviso}</p>
              </div>
            ))}

            {result.errors.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-medium">Linhas com problema</p>
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2 text-xs">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="font-medium text-foreground">Linha {e.row}:</span>{' '}
                      {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Link href="/prospecting/funnel" className={cn(buttonVariants({ size: 'sm' }))}>
                Ver o funil
              </Link>
              <Link
                href="/prospecting/board"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Ver o quadro
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
