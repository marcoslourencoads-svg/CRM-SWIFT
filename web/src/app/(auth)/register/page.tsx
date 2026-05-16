'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

const registerSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  organizationName: z.string().min(2, 'Mínimo 2 caracteres'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', organizationName: '' },
  });

  async function onSubmit(values: RegisterForm) {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', values);
      setAuth(data.data);
      toast.success('Conta criada — bora configurar');
      router.push('/onboarding');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Crie sua conta grátis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Em 60 segundos você tá com pipeline pronto pro seu negócio.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Seu nome</Label>
            <Input
              id="name"
              placeholder="João Paulo"
              autoComplete="name"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="organizationName">Empresa</Label>
            <Input
              id="organizationName"
              placeholder="Minha Empresa"
              autoComplete="organization"
              {...form.register('organizationName')}
            />
            {form.formState.errors.organizationName && (
              <p className="text-xs text-destructive">
                {form.formState.errors.organizationName.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email de trabalho</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            autoComplete="email"
            {...form.register('email')}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
            {...form.register('password')}
          />
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          Criar conta grátis
        </Button>

        <p className="text-center text-[11px] text-muted-foreground">
          Ao criar conta você concorda com nossos termos. Sem cartão de crédito.
        </p>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-emerald-700 hover:underline">
          Fazer login
        </Link>
      </p>
    </div>
  );
}
