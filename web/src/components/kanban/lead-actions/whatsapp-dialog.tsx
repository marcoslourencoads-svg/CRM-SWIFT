'use client';

import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';

interface WhatsappTemplate {
  id: string;
  name: string;
  content: string;
}

interface WhatsappDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  leadPhone?: string | null;
  companyName?: string | null;
}

function applyTemplate(content: string, vars: Record<string, string>) {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

function sanitizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  // Adiciona 55 se não começar com código de país
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function WhatsappDialog({
  open,
  onOpenChange,
  leadName,
  leadPhone,
  companyName,
}: WhatsappDialogProps) {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [preview, setPreview] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    api.get('/whatsapp-templates').then((res) => {
      const list: WhatsappTemplate[] = res.data.data ?? [];
      setTemplates(list);
      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id);
      }
    }).catch(() => {});
  }, [open, selectedId]);

  useEffect(() => {
    const t = templates.find((x) => x.id === selectedId);
    if (!t) return setPreview('');
    setPreview(
      applyTemplate(t.content, {
        nome: leadName,
        empresa: companyName ?? '',
        telefone: leadPhone ?? '',
      }),
    );
  }, [selectedId, templates, leadName, leadPhone, companyName]);

  const send = () => {
    const phone = leadPhone ? sanitizePhone(leadPhone) : '';
    const text = encodeURIComponent(preview);
    const url = phone
      ? `https://wa.me/${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-4" />
            Mandar WhatsApp pra {leadName}
          </DialogTitle>
          <DialogDescription>
            Escolha um template e ajuste a mensagem antes de mandar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem templates cadastrados. Crie em Configurações → Templates WhatsApp.
            </p>
          ) : (
            <div className="space-y-1">
              <Label>Template</Label>
              <Select value={selectedId} onValueChange={(v) => setSelectedId(v ?? '')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Mensagem (edite se quiser)</Label>
            <textarea
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              placeholder="Sua mensagem..."
              className="min-h-[140px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {!leadPhone && (
            <p className="text-xs text-amber-600">
              ⚠️ Lead sem telefone — vai abrir WhatsApp sem destinatário.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={send} disabled={!preview.trim()} className="bg-emerald-600 hover:bg-emerald-700">
            <MessageSquare className="size-3 mr-1" />
            Abrir WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
