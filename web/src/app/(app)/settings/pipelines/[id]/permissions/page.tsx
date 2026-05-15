'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface PipelineMembership {
  userId: string;
  canEdit: boolean;
  canSeeAllLeads: boolean;
}

export default function PipelinePermissionsPage() {
  const params = useParams<{ id: string }>();
  const pipelineId = params.id;

  const [members, setMembers] = useState<Member[]>([]);
  const [perms, setPerms] = useState<Map<string, PipelineMembership>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, pRes] = await Promise.all([
        api.get('/members'),
        api.get(`/pipelines/${pipelineId}/permissions`),
      ]);
      setMembers(mRes.data.data ?? []);
      const map = new Map<string, PipelineMembership>();
      for (const p of (pRes.data.data ?? [])) {
        map.set(p.userId, p);
      }
      setPerms(map);
    } catch {
      toast.error('Erro ao carregar permissões');
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updatePerm = async (
    userId: string,
    field: 'canEdit' | 'canSeeAllLeads',
    value: boolean,
  ) => {
    const current = perms.get(userId) ?? { userId, canEdit: true, canSeeAllLeads: false };
    const next = { ...current, [field]: value };

    setPerms(new Map(perms).set(userId, next));

    try {
      await api.put(`/pipelines/${pipelineId}/permissions`, next);
      toast.success('Permissão atualizada');
    } catch {
      toast.error('Erro ao salvar');
      fetchData();
    }
  };

  const getPerm = (userId: string, role: string): PipelineMembership => {
    const explicit = perms.get(userId);
    if (explicit) return explicit;
    const isPrivileged = role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER';
    return { userId, canEdit: true, canSeeAllLeads: isPrivileged };
  };

  return (
    <div>
      <Link
        href="/settings/pipelines"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="size-3 mr-1" /> Voltar pra Pipelines
      </Link>

      <h2 className="text-lg font-semibold mb-2">Permissões deste pipeline</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Por default, OWNER/ADMIN/MANAGER veem todos os leads e MEMBER vê só os atribuídos a ele.
        Aqui você pode sobrescrever por usuário.
      </p>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2 text-left font-medium">Usuário</th>
                <th className="px-3 py-2 text-center font-medium w-32">Pode editar</th>
                <th className="px-3 py-2 text-center font-medium w-40">Ver todos os leads</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const p = getPerm(m.id, m.role);
                return (
                  <tr key={m.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2">
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.email} · {m.role}</p>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={p.canEdit}
                        onCheckedChange={(v) => updatePerm(m.id, 'canEdit', v)}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={p.canSeeAllLeads}
                        onCheckedChange={(v) => updatePerm(m.id, 'canSeeAllLeads', v)}
                      />
                    </td>
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum membro na org.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
