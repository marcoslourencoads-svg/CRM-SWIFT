'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FolderOpen, MessageSquareQuote, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Separator } from '@/components/ui/separator';
import api from '@/lib/api';
import type { ProspectApproach, ProspectList } from '@/lib/prospecting';

/** Cadência "2, 4, 7" -> [2,4,7]. Ignora o que não for número positivo. */
function parseCadence(input: string): number[] {
  return input
    .split(/[,\s]+/)
    .map((n) => parseInt(n, 10))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 365)
    .slice(0, 12);
}

function describeCadence(days: number[]): string {
  if (days.length === 0) return 'Sem follow-up automático — só a abordagem.';
  const total = days.reduce((a, b) => a + b, 0);
  return `${days.length + 1} toques no total, o último ${total} dias após a abordagem.`;
}

export default function ProspectingListsPage() {
  const [lists, setLists] = useState<ProspectList[]>([]);
  const [approaches, setApproaches] = useState<ProspectApproach[]>([]);
  const [loading, setLoading] = useState(true);
  const [newList, setNewList] = useState({ name: '', niche: '', cadence: '2, 4, 7' });
  const [newApproach, setNewApproach] = useState({ name: '', body: '' });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listsRes, approachesRes] = await Promise.all([
        api.get('/prospect-lists'),
        api.get('/prospect-approaches'),
      ]);
      const loaded: ProspectList[] = listsRes.data.data ?? [];
      setLists(loaded);
      setApproaches(approachesRes.data.data ?? []);
      setDrafts(
        Object.fromEntries(loaded.map((l) => [l.id, l.cadenceDays.join(', ')])),
      );
    } catch {
      toast.error('Não foi possível carregar as listas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createList() {
    if (!newList.name.trim()) {
      toast.error('Dê um nome à lista');
      return;
    }
    try {
      await api.post('/prospect-lists', {
        name: newList.name.trim(),
        niche: newList.niche.trim() || undefined,
        cadenceDays: parseCadence(newList.cadence),
      });
      toast.success('Lista criada');
      setNewList({ name: '', niche: '', cadence: '2, 4, 7' });
      load();
    } catch {
      toast.error('Não foi possível criar a lista');
    }
  }

  async function saveCadence(list: ProspectList) {
    const cadenceDays = parseCadence(drafts[list.id] ?? '');
    try {
      await api.patch(`/prospect-lists/${list.id}`, { name: list.name, cadenceDays });
      toast.success('Cadência atualizada');
      load();
    } catch {
      toast.error('Não foi possível salvar a cadência');
    }
  }

  async function createApproach() {
    if (!newApproach.name.trim()) {
      toast.error('Dê um nome à abordagem');
      return;
    }
    try {
      await api.post('/prospect-approaches', {
        name: newApproach.name.trim(),
        body: newApproach.body.trim() || undefined,
      });
      toast.success('Abordagem criada');
      setNewApproach({ name: '', body: '' });
      load();
    } catch {
      toast.error('Já existe uma abordagem com esse nome');
    }
  }

  async function removeApproach(id: string) {
    try {
      await api.delete(`/prospect-approaches/${id}`);
      toast.success('Abordagem removida');
      load();
    } catch {
      toast.error('Não foi possível remover');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FolderOpen}
        title="Listas e abordagens"
        description="A cadência da lista agenda os follow-ups sozinha"
        count={lists.length}
      />

      {/* Nova lista */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova lista</CardTitle>
          <p className="text-xs text-muted-foreground">
            Uma lista é um lote de prospecção — &quot;Hamburguerias SP&quot;,
            &quot;Pizzarias RJ&quot;. O funil compara a conversão entre elas.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input
                value={newList.name}
                onChange={(e) => setNewList((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Hamburguerias SP"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nicho</Label>
              <Input
                value={newList.niche}
                onChange={(e) => setNewList((f) => ({ ...f, niche: e.target.value }))}
                placeholder="Ex: Hamburgueria"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cadência (dias)</Label>
              <Input
                value={newList.cadence}
                onChange={(e) => setNewList((f) => ({ ...f, cadence: e.target.value }))}
                placeholder="2, 4, 7"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={createList} className="w-full">
                <Plus className="mr-1 size-3.5" />
                Criar lista
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {describeCadence(parseCadence(newList.cadence))}
          </p>
        </CardContent>
      </Card>

      {/* Listas existentes */}
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : lists.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Nenhuma lista ainda"
          description="Crie uma lista para agrupar seus prospects e definir a cadência de follow-up."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {lists.map((list) => (
            <Card key={list.id}>
              <CardHeader>
                <CardTitle className="text-base">{list.name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {list.prospectCount} prospect{list.prospectCount === 1 ? '' : 's'}
                  {list.niche ? ` · ${list.niche}` : ''}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label className="text-xs">Cadência (dias entre os toques)</Label>
                <div className="flex gap-2">
                  <Input
                    value={drafts[list.id] ?? ''}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [list.id]: e.target.value }))
                    }
                    placeholder="2, 4, 7"
                  />
                  <Button variant="outline" onClick={() => saveCadence(list)}>
                    <Save className="size-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {describeCadence(parseCadence(drafts[list.id] ?? ''))}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Separator />

      {/* Abordagens */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareQuote className="size-4" />
            Abordagens
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Os scripts do primeiro toque. Cadastrar aqui (em vez de digitar solto) é
            o que permite comparar a conversão de cada um no funil.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input
                value={newApproach.name}
                onChange={(e) => setNewApproach((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Elogio + pergunta"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Input
                value={newApproach.body}
                onChange={(e) => setNewApproach((f) => ({ ...f, body: e.target.value }))}
                placeholder="Como o script funciona"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={createApproach} className="w-full" variant="outline">
                <Plus className="mr-1 size-3.5" />
                Adicionar
              </Button>
            </div>
          </div>

          {approaches.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {approaches.map((a) => (
                <li key={a.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {a.name}
                      {!a.isActive && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          inativa
                        </span>
                      )}
                    </p>
                    {a.body && (
                      <p className="truncate text-xs text-muted-foreground">{a.body}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeApproach(a.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
