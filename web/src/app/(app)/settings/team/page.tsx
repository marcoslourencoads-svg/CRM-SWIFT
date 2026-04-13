'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserPlus, Copy, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';

interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [membersRes, invitesRes] = await Promise.allSettled([
        api.get('/members'),
        api.get('/invitations'),
      ]);
      if (membersRes.status === 'fulfilled') setMembers(membersRes.value.data.data);
      if (invitesRes.status === 'fulfilled') setInvitations(invitesRes.value.data.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  async function handleInvite() {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const { data } = await api.post('/invitations', {
        email: inviteEmail,
        role: inviteRole,
      });
      toast.success(`Convite enviado para ${inviteEmail}`);
      setDialogOpen(false);
      setInviteEmail('');
      setInviteRole('MEMBER');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao enviar convite');
    } finally {
      setInviting(false);
    }
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  const roleColors: Record<string, string> = {
    OWNER: 'bg-amber-100 text-amber-800',
    ADMIN: 'bg-blue-100 text-blue-800',
    MANAGER: 'bg-purple-100 text-purple-800',
    MEMBER: 'bg-gray-100 text-gray-800',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Time</h2>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Convidar membro
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar novo membro</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="email@empresa.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Select value={inviteRole} onValueChange={(v) => v && setInviteRole(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="MEMBER">Membro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail} className="w-full">
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar convite
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <>
          {/* Members table */}
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left font-medium px-4 py-2">Membro</th>
                  <th className="text-left font-medium px-4 py-2">Email</th>
                  <th className="text-left font-medium px-4 py-2">Função</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          {m.avatarUrl && <AvatarImage src={m.avatarUrl} />}
                          <AvatarFallback className="text-xs">
                            {getInitials(m.name || m.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{m.name || m.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{m.email}</td>
                    <td className="px-4 py-2">
                      <Badge variant="secondary" className={`text-xs ${roleColors[m.role] || ''}`}>
                        {m.role}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pending invitations */}
          {invitations.filter((i) => i.status === 'PENDING').length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Convites pendentes</h3>
              <div className="rounded-lg border">
                <table className="w-full text-sm">
                  <tbody>
                    {invitations
                      .filter((i) => i.status === 'PENDING')
                      .map((inv) => (
                        <tr key={inv.id} className="border-b last:border-b-0 hover:bg-muted/20">
                          <td className="px-4 py-2">{inv.email}</td>
                          <td className="px-4 py-2">
                            <Badge variant="outline" className="text-xs">
                              {inv.role}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground text-xs">
                            Expira em {new Date(inv.expiresAt).toLocaleDateString('pt-BR')}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
