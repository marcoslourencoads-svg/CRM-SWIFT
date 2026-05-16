'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

interface Organization {
  id: string;
  name: string;
}

export default function OrganizationPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    api
      .get('/organizations/me')
      .then((res) => setOrg(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const reseed = async () => {
    if (
      !confirm(
        'Vai criar pipeline + tags + sources + motivos + templates + canal manual padrão.\n\nIdempotente: não duplica nada que já exista.\n\nContinuar?',
      )
    )
      return;
    setSeeding(true);
    try {
      await api.post('/onboarding/reseed');
      toast.success('Setup default aplicado. Recarregue as outras telas pra ver.');
    } catch {
      toast.error('Erro ao aplicar setup');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Organização</h2>
      <Card className="p-6 max-w-lg">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Nome da Organização</Label>
            <Input value={org?.name ?? ''} disabled />
            <p className="text-xs text-muted-foreground">
              Edição indisponível no momento.
            </p>
          </div>
        )}
      </Card>

      <Card className="mt-4 p-6 max-w-lg">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-emerald-600" />
          Setup default
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Re-aplica o pacote zero-config pro nicho delivery: pipeline padrão,
          tags, fontes, motivos de perda, templates WhatsApp e canal manual.
          Idempotente — não duplica nada.
        </p>
        <Button onClick={reseed} disabled={seeding} variant="outline" size="sm">
          {seeding ? 'Aplicando...' : 'Re-aplicar setup default'}
        </Button>
      </Card>
    </div>
  );
}
