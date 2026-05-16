'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bike,
  UtensilsCrossed,
  ShoppingBag,
  Briefcase,
  HelpCircle,
  User,
  Users,
  Building,
  Building2,
  TrendingUp,
  LayoutGrid,
  UsersRound,
  Zap,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const INDUSTRIES = [
  { id: 'delivery', label: 'Delivery', icon: Bike, description: 'iFood, motoboys, dark kitchens' },
  { id: 'foodservice', label: 'Foodservice', icon: UtensilsCrossed, description: 'Restaurantes, bares, lanchonetes' },
  { id: 'varejo', label: 'Varejo', icon: ShoppingBag, description: 'Lojas físicas e online' },
  { id: 'servicos', label: 'Serviços', icon: Briefcase, description: 'Agências, consultorias' },
  { id: 'outro', label: 'Outro', icon: HelpCircle, description: 'Não se encaixa nas opções' },
];

const TEAM_SIZES = [
  { id: 'solo', label: 'Só eu', icon: User, description: 'Trabalho sozinho por enquanto' },
  { id: 'small', label: '2 a 5', icon: Users, description: 'Time pequeno' },
  { id: 'medium', label: '6 a 15', icon: Building, description: 'Crescendo' },
  { id: 'large', label: '16+', icon: Building2, description: 'Empresa estabelecida' },
];

const GOALS = [
  { id: 'vender_mais', label: 'Vender mais', icon: TrendingUp, description: 'Aumentar receita do negócio' },
  { id: 'organizar', label: 'Organizar leads', icon: LayoutGrid, description: 'Parar de perder oportunidades' },
  { id: 'gerenciar_time', label: 'Gerenciar o time', icon: UsersRound, description: 'Acompanhar vendedores' },
  { id: 'automatizar', label: 'Automatizar', icon: Zap, description: 'Reduzir trabalho manual' },
];

const SOURCES = [
  { id: 'meta_ads', label: 'Meta Ads' },
  { id: 'google_ads', label: 'Google Ads' },
  { id: 'indicacao', label: 'Indicação' },
  { id: 'site', label: 'Site' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'outro', label: 'Outro' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [industry, setIndustry] = useState<string | null>(null);
  const [teamSize, setTeamSize] = useState<string | null>(null);
  const [mainGoal, setMainGoal] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const totalSteps = 4;
  const progress = ((step + 1) / totalSteps) * 100;

  const canAdvance =
    (step === 0 && !!industry) ||
    (step === 1 && !!teamSize) ||
    (step === 2 && !!mainGoal) ||
    (step === 3 && sources.length > 0);

  const toggleSource = (id: string) => {
    setSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.post('/onboarding/complete', {
        industry,
        teamSize,
        mainGoal,
        leadSources: sources,
      });
      // Atualiza org no auth-store local
      const orgRaw = localStorage.getItem('organization');
      if (orgRaw) {
        const org = JSON.parse(orgRaw);
        localStorage.setItem(
          'organization',
          JSON.stringify({ ...org, onboardedAt: new Date().toISOString() }),
        );
      }
      toast.success('Tudo pronto! Bem-vindo ao CRM');
      router.replace('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao concluir');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="-m-6 flex min-h-screen flex-col bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-emerald-600" />
            <span className="font-semibold">Vamos configurar seu CRM</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Passo {step + 1} de {totalSteps}
          </span>
        </div>
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          {step === 0 && (
            <StepCardGrid
              title="Em qual setor você atua?"
              subtitle="Vou usar isso pra personalizar pipelines e templates pro seu nicho."
              options={INDUSTRIES}
              selected={industry}
              onSelect={setIndustry}
            />
          )}

          {step === 1 && (
            <StepCardGrid
              title="Quantas pessoas vão usar o CRM?"
              subtitle="Pra você ter ideia da sua estrutura. Pode ajustar depois."
              options={TEAM_SIZES}
              selected={teamSize}
              onSelect={setTeamSize}
            />
          )}

          {step === 2 && (
            <StepCardGrid
              title="Qual seu principal objetivo?"
              subtitle="A gente prioriza as features que te ajudam a chegar lá."
              options={GOALS}
              selected={mainGoal}
              onSelect={setMainGoal}
            />
          )}

          {step === 3 && (
            <div>
              <h1 className="mb-1 text-2xl font-bold">De onde vêm seus leads?</h1>
              <p className="mb-6 text-sm text-muted-foreground">
                Pode marcar várias. Eu deixo essas fontes ativas no setup.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {SOURCES.map((s) => {
                  const isActive = sources.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSource(s.id)}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-lg border-2 p-4 text-sm font-medium transition-all',
                        isActive
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                          : 'border-border bg-white hover:border-emerald-300',
                      )}
                    >
                      {isActive && <Check className="size-4 text-emerald-600" />}
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="ghost"
              disabled={step === 0 || submitting}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ArrowLeft className="mr-1 size-4" /> Voltar
            </Button>

            {step < totalSteps - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance}
              >
                Avançar <ArrowRight className="ml-1 size-4" />
              </Button>
            ) : (
              <Button
                onClick={submit}
                disabled={!canAdvance || submitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? 'Salvando...' : 'Concluir e entrar'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepCardGrid({
  title,
  subtitle,
  options,
  selected,
  onSelect,
}: {
  title: string;
  subtitle: string;
  options: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">{title}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isActive = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              className={cn(
                'flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all',
                isActive
                  ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                  : 'border-border bg-white hover:border-emerald-300',
              )}
            >
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-lg',
                  isActive ? 'bg-emerald-500 text-white' : 'bg-muted',
                )}
              >
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
              {isActive && <Check className="size-4 shrink-0 text-emerald-600" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
