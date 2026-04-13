'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ColorPicker } from '@/components/ui/color-picker';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import api from '@/lib/api';

interface Tag {
  id: string;
  name: string;
  color: string;
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');

  const fetchTags = useCallback(async () => {
    try {
      const res = await api.get('/tags');
      setTags(res.data.data);
    } catch {
      toast.error('Erro ao carregar tags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const openCreate = () => {
    setEditingTag(null);
    setName('');
    setColor('#6366f1');
    setDialogOpen(true);
  };

  const openEdit = (tag: Tag) => {
    setEditingTag(tag);
    setName(tag.name);
    setColor(tag.color);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      if (editingTag) {
        await api.patch(`/tags/${editingTag.id}`, { name, color });
        toast.success('Tag atualizada');
      } else {
        await api.post('/tags', { name, color });
        toast.success('Tag criada');
      }
      setDialogOpen(false);
      fetchTags();
    } catch {
      toast.error('Erro ao salvar tag');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta tag?')) return;
    try {
      await api.delete(`/tags/${id}`);
      toast.success('Tag excluída');
      fetchTags();
    } catch {
      toast.error('Erro ao excluir tag');
    }
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-4">Tags</h2>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Tags</h2>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Tag
        </Button>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left font-medium px-4 py-2">Nome</th>
              <th className="text-left font-medium px-4 py-2">Preview</th>
              <th className="text-right font-medium px-4 py-2 w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((tag) => (
              <tr key={tag.id} className="border-b last:border-b-0 hover:bg-muted/20">
                <td className="px-4 py-2">{tag.name}</td>
                <td className="px-4 py-2">
                  <Badge
                    style={{ backgroundColor: tag.color, color: '#fff' }}
                    className="border-0"
                  >
                    {tag.name}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEdit(tag)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDelete(tag.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {tags.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhuma tag cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? 'Editar Tag' : 'Nova Tag'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Hot Lead"
              />
            </div>
            <div className="space-y-1">
              <Label>Cor</Label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave}>
              {editingTag ? 'Salvar' : 'Criar Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
