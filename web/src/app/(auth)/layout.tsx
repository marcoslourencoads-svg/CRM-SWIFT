import { CheckCircle2, MessageSquare, Sparkles, Users } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Coluna esquerda — brand panel (escondida em mobile) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-12 text-white lg:flex">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-teal-400/20 blur-3xl" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-white text-emerald-700">
              <Sparkles className="size-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">CRM Swift</span>
          </div>
        </div>

        {/* Pitch */}
        <div className="relative z-10 space-y-6">
          <div>
            <h2 className="text-3xl font-bold leading-tight">
              CRM brasileiro com WhatsApp nativo, automação real e velocidade que cliente sente.
            </h2>
            <p className="mt-3 text-sm text-emerald-100">
              Feito pra agências de tráfego e times comerciais que precisam fechar mais e organizar menos.
            </p>
          </div>

          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <MessageSquare className="mt-0.5 size-4 shrink-0 text-emerald-200" />
              <span>Inbox WhatsApp integrado, sem addon caro</span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-200" />
              <span>Automações que disparam de verdade</span>
            </li>
            <li className="flex items-start gap-2">
              <Users className="mt-0.5 size-4 shrink-0 text-emerald-200" />
              <span>Time, chat interno e permissões inclusas</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-200" />
              <span>Pipeline pronto em 60 segundos pro seu nicho</span>
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-emerald-100/80">
          © {new Date().getFullYear()} CRM Swift — feito pra quem vende
        </div>
      </aside>

      {/* Coluna direita — form */}
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6 lg:px-12">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Sparkles className="size-4" />
            </div>
            <span className="font-semibold">CRM Swift</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
