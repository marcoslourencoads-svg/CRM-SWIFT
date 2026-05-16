'use client';

import { usePathname } from 'next/navigation';
import { AuthGuard } from '@/components/layout/auth-guard';
import { Sidebar } from '@/components/layout/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideShell = pathname === '/onboarding';

  if (hideShell) {
    return (
      <AuthGuard>
        <main className="min-h-screen bg-background p-6">{children}</main>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-background p-6">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
