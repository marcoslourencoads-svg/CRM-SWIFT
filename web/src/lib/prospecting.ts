/**
 * Tipos e rótulos da prospecção ativa.
 *
 * A etapa aqui é UM campo, não a combinação de onze booleanos como era
 * na planilha — por isso ela pode ter rótulo, cor e ordem em um lugar só.
 */

export type ProspectStage =
  | 'NEW'
  | 'CONTACTED'
  | 'FOLLOW_UP'
  | 'RESPONDED'
  | 'MEETING_SET'
  | 'MEETING_DONE'
  | 'WON'
  | 'LOST'
  | 'DISQUALIFIED';

export type ProspectChannel = 'INSTAGRAM' | 'WHATSAPP' | 'EMAIL' | 'PHONE' | 'OTHER';

export type TouchOutcome =
  | 'NO_REPLY'
  | 'REPLIED_POSITIVE'
  | 'REPLIED_NEGATIVE'
  | 'NO_ANSWER'
  | 'BOUNCED';

export interface ProspectTouch {
  id: string;
  sequence: number;
  channel: ProspectChannel;
  outcome: TouchOutcome;
  message: string | null;
  sentAt: string;
  approach?: { id: string; name: string } | null;
}

export interface Prospect {
  id: string;
  name: string;
  business: string | null;
  handle: string | null;
  profileUrl: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  niche: string | null;
  hasAds: boolean | null;
  followers: number | null;
  stage: ProspectStage;
  channel: ProspectChannel;
  touchCount: number;
  lastTouchAt: string | null;
  nextActionAt: string | null;
  firstContactedAt: string | null;
  respondedAt: string | null;
  meetingSetAt: string | null;
  meetingHeldAt: string | null;
  wonAt: string | null;
  lostAt: string | null;
  dealValue: number;
  lostReasonId: string | null;
  lostNote: string | null;
  leadId: string | null;
  notes: string | null;
  createdAt: string;
  owner?: { id: string; name: string; email: string } | null;
  list?: { id: string; name: string; cadenceDays: number[] } | null;
  touches: ProspectTouch[];
}

export interface ProspectList {
  id: string;
  name: string;
  description: string | null;
  niche: string | null;
  cadenceDays: number[];
  archivedAt: string | null;
  prospectCount: number;
}

export interface ProspectApproach {
  id: string;
  name: string;
  body: string | null;
  isActive: boolean;
  position: number;
}

// A ordem aqui é a ordem do funil, e é ela que desenha as colunas do
// quadro. Perda e desqualificação ficam fora da trilha principal.
export const STAGE_META: Record<
  ProspectStage,
  { label: string; short: string; color: string; dot: string; badge: string }
> = {
  NEW: {
    label: 'Não abordado',
    short: 'Novo',
    color: '#94A3B8',
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-700',
  },
  CONTACTED: {
    label: 'Abordado',
    short: 'Abordado',
    color: '#3B82F6',
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700',
  },
  FOLLOW_UP: {
    label: 'Em follow-up',
    short: 'Follow-up',
    color: '#6366F1',
    dot: 'bg-indigo-500',
    badge: 'bg-indigo-100 text-indigo-700',
  },
  RESPONDED: {
    label: 'Respondeu',
    short: 'Respondeu',
    color: '#8B5CF6',
    dot: 'bg-violet-500',
    badge: 'bg-violet-100 text-violet-700',
  },
  MEETING_SET: {
    label: 'Reunião agendada',
    short: 'Agendada',
    color: '#F59E0B',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700',
  },
  MEETING_DONE: {
    label: 'Reunião realizada',
    short: 'Realizada',
    color: '#14B8A6',
    dot: 'bg-teal-500',
    badge: 'bg-teal-100 text-teal-700',
  },
  WON: {
    label: 'Fechou contrato',
    short: 'Fechou',
    color: '#10B981',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  LOST: {
    label: 'Perdido',
    short: 'Perdido',
    color: '#EF4444',
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700',
  },
  DISQUALIFIED: {
    label: 'Desqualificado',
    short: 'Fora do perfil',
    color: '#78716C',
    dot: 'bg-stone-500',
    badge: 'bg-stone-100 text-stone-700',
  },
};

export const BOARD_STAGES: ProspectStage[] = [
  'NEW',
  'CONTACTED',
  'FOLLOW_UP',
  'RESPONDED',
  'MEETING_SET',
  'MEETING_DONE',
  'WON',
  'LOST',
];

export const CHANNEL_META: Record<ProspectChannel, { label: string; icon: string }> = {
  INSTAGRAM: { label: 'Instagram', icon: '📷' },
  WHATSAPP: { label: 'WhatsApp', icon: '💬' },
  EMAIL: { label: 'E-mail', icon: '✉️' },
  PHONE: { label: 'Ligação', icon: '📞' },
  OTHER: { label: 'Outro canal', icon: '•' },
};

export const OUTCOME_META: Record<TouchOutcome, { label: string; badge: string }> = {
  NO_REPLY: { label: 'Sem resposta', badge: 'bg-slate-100 text-slate-600' },
  REPLIED_POSITIVE: { label: 'Respondeu — positivo', badge: 'bg-emerald-100 text-emerald-700' },
  REPLIED_NEGATIVE: { label: 'Respondeu — negativo', badge: 'bg-orange-100 text-orange-700' },
  NO_ANSWER: { label: 'Não atendeu', badge: 'bg-slate-100 text-slate-600' },
  BOUNCED: { label: 'Não entregue', badge: 'bg-red-100 text-red-700' },
};

// ─── Datas ────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000;

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function formatDateBR(value: string | null | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export function formatFullDateBR(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR');
}

export function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

/** Dia da cadência: D0 no dia da abordagem, D5 cinco dias depois. */
export function cadenceDay(p: Prospect): string | null {
  if (!p.firstContactedAt) return null;
  const days = Math.floor((Date.now() - new Date(p.firstContactedAt).getTime()) / DAY);
  return `D${Math.max(days, 0)}`;
}

export function isOverdue(p: Prospect): boolean {
  if (!p.nextActionAt) return false;
  return new Date(p.nextActionAt) < startOfToday();
}

/** Quantos dias de atraso — usado para ordenar o que cobra primeiro. */
export function daysOverdue(p: Prospect): number {
  if (!p.nextActionAt) return 0;
  const diff = startOfToday().getTime() - new Date(p.nextActionAt).getTime();
  return Math.max(Math.ceil(diff / DAY), 0);
}

/** Rótulo do card: o negócio lidera, a pessoa é o fallback. */
export function displayName(p: Prospect): string {
  return p.business?.trim() || p.name;
}

export function subtitleOf(p: Prospect): string {
  const parts = [
    p.niche,
    CHANNEL_META[p.channel]?.label,
    cadenceDay(p),
    p.handle ? `@${p.handle}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

/** Link para abrir o canal do prospect direto da fila. */
export function contactLink(p: Prospect): string | null {
  if (p.channel === 'WHATSAPP' && p.phone) {
    return `https://wa.me/${p.phone.replace(/\D/g, '')}`;
  }
  if (p.channel === 'EMAIL' && p.email) return `mailto:${p.email}`;
  if (p.channel === 'PHONE' && p.phone) return `tel:${p.phone.replace(/\D/g, '')}`;
  if (p.profileUrl) return p.profileUrl;
  if (p.handle) return `https://www.instagram.com/${p.handle}/`;
  if (p.phone) return `https://wa.me/${p.phone.replace(/\D/g, '')}`;
  if (p.email) return `mailto:${p.email}`;
  return null;
}

/** Próximo toque na cadência: "FUP 2" quando já houve 2 toques. */
export function nextTouchLabel(p: Prospect): string {
  return p.touchCount === 0 ? 'Abordagem' : `FUP ${p.touchCount}`;
}

export function formatPct(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 2).replace('.', ',')}%`;
}
