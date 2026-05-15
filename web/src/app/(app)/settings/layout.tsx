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
  ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const settingsNav = [
  { href: '/settings/organization', label: 'Organização', icon: Building2 },
  { href: '/settings/pipelines', label: 'Pipelines', icon: Kanban },
  { href: '/settings/custom-fields', label: 'Campos Adicionais', icon: Sliders },
  { href: '/settings/tags', label: 'Tags', icon: Tags },
  { href: '/settings/lead-sources', label: 'Fontes de Origem', icon: Globe },
  { href: '/settings/scoring', label: 'Lead Scoring', icon: Target },
  { href: '/settings/lost-reasons', label: 'Motivos de Perda', icon: XCircle },
  { href: '/settings/whatsapp-templates', label: 'Templates WhatsApp', icon: MessageSquare },
  { href: '/settings/team', label: 'Time', icon: Users },
  { href: '/settings/audit', label: 'Audit Log', icon: ScrollText },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full gap-8">
      <aside className="w-56 shrink-0">
        <h1 className="mb-4 text-lg font-semibold">Configurações</h1>
        <nav className="flex flex-col gap-0.5">
          {settingsNav.map((item) => {
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
        </nav>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
