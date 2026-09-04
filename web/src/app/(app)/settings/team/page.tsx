'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserPlus, Loader2, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
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
  const { organization } = useAuthStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('MEMBER');
  const [saving, setSaving] = useState(false);
  const [savingRoleFor, setSavingRoleFor] = useState<string | null>(null);

  const myRole = organization?.role ?? 'MEMBER';
  const canChangeRoles = myRole === 'OWNER' || myRole === 'ADMIN';

  async function handleChangeRole(membership: Member, newRole: string) {
    if (newRole === membership.role) return;
    setSavingRoleFor(membership.id);
    try {
      await api.patch(`/members/${membership.id}/role`, { role: newRole });
      setMembers((prev) =>
        prev.map((m) => (m.id === membership.id ? { ...m, role: newRole } : m)),
      );
      toast.success(`Função atualizada para ${newRole}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao alterar função');
    } finally {
      setSavingRoleFor(null);
    }
  }

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

  function generatePassword() {
    const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint32Array(12));
    setNewPassword(Array.from(bytes, (b) => alphabet[b % alphabet.length]).join(''));
  }

  async function handleAddMember() {
    if (!newName || !newEmail || !newPassword) return;
    setSaving(true);
    try {
      const { data } = await api.post('/members', {
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
      });
      if (data.data?.userAlreadyExisted) {
        toast.success(
          `${newEmail} já tinha conta e foi adicionada ao time. Ela entra com a senha dela — a senha digitada aqui foi ignorada.`,
        );
      } else {
        toast.success(`${newEmail} adicionado. Envie o email e a senha para a pessoa entrar.`);
      }
      setDialogOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('MEMBER');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao adicionar membro');
    } finally {
      setSaving(false);
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
          Adicionar membro
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar novo membro</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">
                A pessoa entra na hora com o email e a senha definidos aqui. Envie os dados
                para ela — o sistema não dispara email.
              </p>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  placeholder="Maria Silva"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="email@empresa.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Senha provisória (mín. 8 caracteres)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="mínimo 8 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={generatePassword}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                {newPassword.length > 0 && newPassword.length < 8 ? (
                  <p className="text-xs text-destructive">
                    A senha precisa de pelo menos 8 caracteres — faltam{' '}
                    {8 - newPassword.length}. Use o botão ao lado para gerar uma.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Mínimo de 8 caracteres. Fica visível para você copiar — peça para a pessoa
                    trocar depois de entrar.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Select value={newRole} onValueChange={(v) => v && setNewRole(v)}>
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
              <Button
                onClick={handleAddMember}
                disabled={saving || !newName || !newEmail || newPassword.length < 8}
                className="w-full"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Adicionar membro
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
                      {m.role === 'OWNER' || !canChangeRoles ? (
                        <Badge variant="secondary" className={`text-xs ${roleColors[m.role] || ''}`}>
                          {m.role}
                        </Badge>
                      ) : (
                        <Select
                          value={m.role}
                          onValueChange={(v) => v && handleChangeRole(m, v)}
                          disabled={savingRoleFor === m.id}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                            <SelectItem value="MANAGER">Manager</SelectItem>
                            <SelectItem value="MEMBER">Membro</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
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
