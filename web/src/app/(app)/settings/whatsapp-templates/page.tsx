'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import api from '@/lib/api';

interface WhatsappTemplate {
  id: string;
  name: string;
  content: string;
}

export default function WhatsappTemplatesPage() {
  const [list, setList] = useState<WhatsappTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WhatsappTemplate | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/whatsapp-templates');
      setList(res.data.data ?? []);
    } catch {
      toast.error('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setEditing(null); setName(''); setContent(''); setDialogOpen(true); };
  const openEdit = (t: WhatsappTemplate) => {
    setEditing(t); setName(t.name); setContent(t.content); setDialogOpen(true);
  };

  const save = async () => {
    if (!name.trim() || !content.trim()) return toast.error('Preencha nome e conteúdo');
    try {
      if (editing) {
        await api.patch(`/whatsapp-templates/${editing.id}`, { name, content });
      } else {
        await api.post('/whatsapp-templates', { name, content });
      }
      toast.success('Template salvo');
      setDialogOpen(false); fetch();
    } catch {
      toast.error('Erro ao salvar');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir template?')) return;
    await api.delete(`/whatsapp-templates/${id}`);
    fetch();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Templates de WhatsApp</h2>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Mensagens pré-prontas pra disparar do drawer do lead. Use <code className="text-xs bg-muted px-1 rounded">{'{{nome}}'}</code>, <code className="text-xs bg-muted px-1 rounded">{'{{empresa}}'}</code>, <code className="text-xs bg-muted px-1 rounded">{'{{telefone}}'}</code> que serão substituídos automaticamente.
      </p>

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="space-y-2">
          {list.map((t) => (
            <div key={t.id} className="rounded-lg border p-3 hover:bg-muted/20">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium">{t.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.content}</p>
                </div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon-xs" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => remove(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <div className="rounded-lg border p-6 text-center text-muted-foreground text-sm">
              Nenhum template cadastrado.
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar template' : 'Novo template'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Primeiro contato" />
            </div>
            <div className="space-y-1">
              <Label>Mensagem</Label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Olá {{nome}}, tudo bem? Sou da Agência Swift..."
                className="min-h-[140px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save}>{editing ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
