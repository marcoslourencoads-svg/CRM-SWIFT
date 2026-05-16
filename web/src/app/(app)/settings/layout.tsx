'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  Kanban,
  Tags,
  Globe,
  Sliders,
  Users,
  Target,
  XCircle,
  MessageSquare,
  Zap,
  Inbox,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const settingsGroups = [
  {
    label: 'Geral',
    items: [
      { href: '/settings/organization', label: 'Organização', icon: Building2 },
      { href: '/settings/team', label: 'Time', icon: Users },
      { href: '/leads/import', label: 'Importar leads', icon: Upload },
    ],
  },
  {
    label: 'Pipeline & Vendas',
    items: [
      { href: '/settings/pipelines', label: 'Pipelines', icon: Kanban },
      { href: '/settings/custom-fields', label: 'Campos adicionais', icon: Sliders },
      { href: '/settings/scoring', label: 'Lead scoring', icon: Target },
      { href: '/settings/lost-reasons', label: 'Motivos de perda', icon: XCircle },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { href: '/settings/tags', label: 'Tags', icon: Tags },
      { href: '/settings/lead-sources', label: 'Fontes de origem', icon: Globe },
    ],
  },
  {
    label: 'Comunicação & Automação',
    items: [
      { href: '/settings/channels', label: 'Canais', icon: Inbox },
      { href: '/settings/whatsapp-templates', label: 'Templates WhatsApp', icon: MessageSquare },
      { href: '/settings/automations', label: 'Automações', icon: Zap },
    ],
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full gap-8">
      <aside className="w-60 shrink-0">
        <h1 className="mb-4 text-lg font-semibold">Configurações</h1>
        <nav className="flex flex-col">
          {settingsGroups.map((group, idx) => (
            <div key={group.label} className={cn(idx > 0 && 'mt-4')}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
