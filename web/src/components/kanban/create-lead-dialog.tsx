'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  statusId: string;
  onCreated: () => void;
}

export function CreateLeadDialog({
  open,
  onOpenChange,
  pipelineId,
  statusId,
  onCreated,
}: CreateLeadDialogProps) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [contactName, setContactName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      await api.post(`/pipelines/${pipelineId}/leads`, {
        title: title.trim(),
        contactName: contactName.trim() || undefined,
        companyName: companyName.trim() || undefined,
        estimatedValue: estimatedValue ? Math.round(parseFloat(estimatedValue) * 100) : undefined,
        statusId,
      });
      setTitle('');
      setContactName('');
      setCompanyName('');
      setEstimatedValue('');
      onOpenChange(false);
      onCreated();
    } catch (err) {
      console.error('Failed to create lead:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titulo *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Projeto Website"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactName">Nome do contato</Label>
            <Input
              id="contactName"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Ex: Maria Silva"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">Empresa</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex: Acme Corp"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="estimatedValue">Valor estimado (R$)</Label>
            <Input
              id="estimatedValue"
              type="number"
              step="0.01"
              min="0"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              placeholder="Ex: 5000.00"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !title.trim()}>
              {loading ? 'Criando...' : 'Criar Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
