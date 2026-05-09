'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import api from '@/lib/api';

interface DeleteLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadTitle: string;
  onSuccess?: () => void;
}

export function DeleteLeadDialog({
  open,
  onOpenChange,
  leadId,
  leadTitle,
  onSuccess,
}: DeleteLeadDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/leads/${leadId}`);
      toast.success('Lead excluído');
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error('Erro ao excluir lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="size-4" />
            Excluir lead
          </DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir <strong>{leadTitle}</strong>? Esta
            ação pode ser revertida pelo admin via banco de dados.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={submitting}
            className="bg-red-600 hover:bg-red-700"
          >
            {submitting ? 'Excluindo...' : 'Excluir definitivamente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
