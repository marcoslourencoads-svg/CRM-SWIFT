'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, hydrate, organization } = useAuthStore();
  const [checked, setChecked] = useState(false);
  const [onboardedChecked, setOnboardedChecked] = useState(false);

  useEffect(() => {
    hydrate();
    setChecked(true);
  }, [hydrate]);

  useEffect(() => {
    if (checked && !isAuthenticated) {
      router.replace('/login');
    }
  }, [checked, isAuthenticated, router]);

  // Onboarding gate: se org não tem onboardedAt, força wizard
  useEffect(() => {
    if (!checked || !isAuthenticated || !organization) {
      return;
    }
    // Se já temos info de onboardedAt no store, decide direto
    if (organization.onboardedAt !== undefined) {
      if (!organization.onboardedAt && pathname !== '/onboarding') {
        router.replace('/onboarding');
      }
      setOnboardedChecked(true);
      return;
    }
    // Senão, busca da API
    api
      .get('/organizations/me')
      .then((res) => {
        const onboardedAt = res.data.data?.onboardedAt ?? null;
        // Atualiza localStorage pra próximas navegações
        const orgRaw = localStorage.getItem('organization');
        if (orgRaw) {
          const org = JSON.parse(orgRaw);
          localStorage.setItem(
            'organization',
            JSON.stringify({ ...org, onboardedAt }),
          );
        }
        if (!onboardedAt && pathname !== '/onboarding') {
          router.replace('/onboarding');
        }
      })
      .catch(() => {
        // silencioso — se a API falhar, deixa entrar; bug se for problema real
      })
      .finally(() => setOnboardedChecked(true));
  }, [checked, isAuthenticated, organization, pathname, router]);

  if (!checked || !isAuthenticated || !onboardedChecked) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
