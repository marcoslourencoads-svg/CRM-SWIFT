'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Kanban,
  ChevronDown,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { NotificationsPopover } from '@/components/notifications/notifications-popover';
import api from '@/lib/api';

interface Pipeline {
  id: string;
  name: string;
}

const staticNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/meta-ads', label: 'Meta Ads', icon: BarChart3 },
  { href: '/settings/team', label: 'Time', icon: Users },
  { href: '/settings/organization', label: 'Configurações', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelinesOpen, setPipelinesOpen] = useState(true);

  useEffect(() => {
    api
      .get('/pipelines')
      .then((res) => setPipelines(res.data.data))
      .catch(() => {});
  }, []);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card">
      <div className="flex h-14 items-center justify-between px-4">
        <span className="font-semibold text-lg">CRM</span>
        <NotificationsPopover />
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {/* Dashboard */}
        <Link
          href="/dashboard"
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            pathname.startsWith('/dashboard')
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>

        {/* Pipelines section */}
        <button
          onClick={() => setPipelinesOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground transition-colors"
        >
          <Kanban className="h-4 w-4" />
          <span className="flex-1 text-left">Pipelines</span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 transition-transform',
              pipelinesOpen && 'rotate-180',
            )}
          />
        </button>

        {pipelinesOpen &&
          pipelines.map((pipeline) => {
            const href = `/pipelines/${pipeline.id}/board`;
            const isActive = pathname.startsWith(`/pipelines/${pipeline.id}`);
            return (
              <Link
                key={pipeline.id}
                href={href}
                className={cn(
                  'flex items-center justify-between rounded-md py-1.5 pl-10 pr-3 text-sm transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
                )}
              >
                {pipeline.name}
              </Link>
            );
          })}

        <Separator className="my-2" />

        {/* Team and Settings */}
        {staticNavItems.slice(1).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <Separator />
      <div className="p-2">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm text-muted-foreground truncate">
            {user?.email}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
