'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';

interface Organization {
  id: string;
  name: string;
}

export default function OrganizationPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/organizations/me')
      .then((res) => setOrg(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
    </div>
  );
}
