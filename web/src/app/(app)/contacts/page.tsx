'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Plus, Building2, User as UserIcon, ExternalLink, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  company: { id: string; name: string } | null;
  _count: { leads: number };
}

interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  website: string | null;
  _count: { contacts: number; leads: number };
}

export default function ContactsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UserIcon className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Contatos</h1>
      </div>

      <Tabs defaultValue="contacts">
        <TabsList variant="line">
          <TabsTrigger value="contacts">
            <UserIcon className="mr-1 size-3" /> Contatos
          </TabsTrigger>
          <TabsTrigger value="companies">
            <Building2 className="mr-1 size-3" /> Empresas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="pt-4">
          <ContactsTab />
        </TabsContent>
        <TabsContent value="companies" className="pt-4">
          <CompaniesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ───────────── Contacts ─────────────

function ContactsTab() {
  const [list, setList] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', jobTitle: '', companyId: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await api.get(`/contacts?${params}`);
      setList(res.data.data ?? []);
    } catch (err: any) {
      if (err?.response?.status >= 500) {
        toast.error('Erro ao carregar contatos');
      } else {
        console.warn('[/contacts] falha não-fatal:', err?.message);
        setList([]);
      }
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/companies').then((r) => setCompanies(r.data.data ?? [])).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', phone: '', jobTitle: '', companyId: '' });
    setOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({
      name: c.name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      jobTitle: c.jobTitle ?? '',
      companyId: c.company?.id ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Nome obrigatório');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
        companyId: form.companyId || undefined,
      };
      if (editing) {
        await api.patch(`/contacts/${editing.id}`, payload);
        toast.success('Contato atualizado');
      } else {
        await api.post('/contacts', payload);
        toast.success('Contato criado');
      }
      setOpen(false);
      load();
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Contact) => {
    if (!confirm(`Apagar contato "${c.name}"?`)) return;
    try {
      await api.delete(`/contacts/${c.id}`);
      toast.success('Contato apagado');
      load();
    } catch {
      toast.error('Erro ao apagar');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, email ou telefone..."
            className="h-8 pl-7 text-sm"
          />
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 size-3" /> Novo contato
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : list.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          Sem contatos. Crie o primeiro com o botão acima.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Nome</th>
                <th className="px-3 py-2 text-left font-semibold">Email</th>
                <th className="px-3 py-2 text-left font-semibold">Telefone</th>
                <th className="px-3 py-2 text-left font-semibold">Cargo</th>
                <th className="px-3 py-2 text-left font-semibold">Empresa</th>
                <th className="px-3 py-2 text-center font-semibold">Leads</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b hover:bg-muted/30 last:border-b-0">
                  <td className="px-3 py-2">
                    <button onClick={() => openEdit(c)} className="font-medium hover:underline">
                      {c.name}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.email ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.phone ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.jobTitle ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{c.company?.name ?? '—'}</td>
                  <td className="px-3 py-2 text-center">
                    {c._count.leads > 0 && (
                      <Badge variant="outline">{c._count.leads}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(c)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar contato' : 'Novo contato'}</DialogTitle>
            <DialogDescription>
              Contatos podem ser vinculados a uma empresa e a vários leads.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cargo</Label>
                <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Empresa</Label>
                <Select value={form.companyId} onValueChange={(v) => setForm({ ...form, companyId: v ?? '' })}>
                  <SelectTrigger><SelectValue placeholder="Sem empresa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem empresa</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ───────────── Companies ─────────────

function CompaniesTab() {
  const [list, setList] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState({ name: '', domain: '', industry: '', website: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await api.get(`/companies?${params}`);
      setList(res.data.data ?? []);
    } catch (err: any) {
      if (err?.response?.status >= 500) {
        toast.error('Erro ao carregar empresas');
      } else {
        console.warn('[/companies] falha não-fatal:', err?.message);
        setList([]);
      }
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', domain: '', industry: '', website: '' });
    setOpen(true);
  };

  const openEdit = (c: Company) => {
    setEditing(c);
    setForm({
      name: c.name,
      domain: c.domain ?? '',
      industry: c.industry ?? '',
      website: c.website ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Nome obrigatório');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        domain: form.domain.trim() || undefined,
        industry: form.industry.trim() || undefined,
        website: form.website.trim() || undefined,
      };
      if (editing) {
        await api.patch(`/companies/${editing.id}`, payload);
        toast.success('Empresa atualizada');
      } else {
        await api.post('/companies', payload);
        toast.success('Empresa criada');
      }
      setOpen(false);
      load();
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Company) => {
    if (!confirm(`Apagar empresa "${c.name}"? Contatos e leads vinculados continuam.`)) return;
    try {
      await api.delete(`/companies/${c.id}`);
      toast.success('Empresa apagada');
      load();
    } catch {
      toast.error('Erro ao apagar');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou domínio..."
            className="h-8 pl-7 text-sm"
          />
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 size-3" /> Nova empresa
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : list.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          Sem empresas cadastradas.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Nome</th>
                <th className="px-3 py-2 text-left font-semibold">Indústria</th>
                <th className="px-3 py-2 text-left font-semibold">Domínio</th>
                <th className="px-3 py-2 text-left font-semibold">Website</th>
                <th className="px-3 py-2 text-center font-semibold">Contatos</th>
                <th className="px-3 py-2 text-center font-semibold">Leads</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b hover:bg-muted/30 last:border-b-0">
                  <td className="px-3 py-2">
                    <button onClick={() => openEdit(c)} className="font-medium hover:underline">
                      {c.name}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.industry ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.domain ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    {c.website ? (
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        Abrir <ExternalLink className="size-2.5" />
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c._count.contacts > 0 && <Badge variant="outline">{c._count.contacts}</Badge>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c._count.leads > 0 && <Badge variant="outline">{c._count.leads}</Badge>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(c)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar empresa' : 'Nova empresa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Indústria</Label>
                <Input
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  placeholder="Ex: Delivery"
                />
              </div>
              <div className="space-y-1">
                <Label>Domínio</Label>
                <Input
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="exemplo.com"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Website</Label>
              <Input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
