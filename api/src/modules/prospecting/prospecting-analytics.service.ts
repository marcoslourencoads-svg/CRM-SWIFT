import { Injectable } from '@nestjs/common';
import { Prisma, ProspectChannel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Abaixo disto a taxa é ruído, não sinal. A planilha decidia com 19
// abordagens e 1 resposta; o front marca estes cortes como
// "amostra insuficiente" em vez de deixar o número passar por verdade.
const MIN_SAMPLE = 30;

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  listId?: string;
  ownerId?: string;
  channel?: ProspectChannel;
  hasAds?: boolean;
  niche?: string;
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  pctFromPrev: number;
  pctFromTop: number;
}

export interface CutRow {
  chave: string;
  label: string;
  abordados: number;
  respostas: number;
  reunioesAgendadas: number;
  reunioesFeitas: number;
  fechamentos: number;
  receita: number;
  taxaResposta: number;
  taxaFechamento: number;
  amostraSuficiente: boolean;
}

type CohortProspect = Prisma.ProspectGetPayload<{
  include: {
    owner: { select: { id: true; name: true } };
    list: { select: { id: true; name: true } };
    touches: { include: { approach: { select: { id: true; name: true } } } };
  };
}>;

const STEP_DEFS: { key: keyof CohortProspect & string; label: string }[] = [
  { key: 'firstContactedAt', label: 'Abordados' },
  { key: 'respondedAt', label: 'Responderam' },
  { key: 'meetingSetAt', label: 'Reuniões agendadas' },
  { key: 'meetingHeldAt', label: 'Reuniões realizadas' },
  { key: 'wonAt', label: 'Fechamentos' },
];

const CHANNEL_LABEL: Record<ProspectChannel, string> = {
  INSTAGRAM: 'Instagram',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
  PHONE: 'Ligação',
  OTHER: 'Outro',
};

@Injectable()
export class ProspectingAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFunnel(orgId: string, filters: AnalyticsFilters) {
    const cohort = await this.loadCohort(orgId, filters);
    return {
      periodo: { from: filters.from ?? null, to: filters.to ?? null },
      amostra: cohort.length,
      amostraSuficiente: cohort.length >= MIN_SAMPLE,
      etapas: this.buildSteps(cohort),
      metricas: this.buildMetrics(cohort),
    };
  }

  async getAnalytics(orgId: string, filters: AnalyticsFilters) {
    const cohort = await this.loadCohort(orgId, filters);
    const lostReasons = await this.prisma.lostReason.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
    });
    const reasonName = new Map(lostReasons.map((r) => [r.id, r.name]));

    return {
      periodo: { from: filters.from ?? null, to: filters.to ?? null },
      amostra: cohort.length,
      amostraSuficiente: cohort.length >= MIN_SAMPLE,
      etapas: this.buildSteps(cohort),
      metricas: this.buildMetrics(cohort),
      porToque: this.buildByTouchNumber(cohort),
      cortes: {
        porAbordagem: this.cutBy(cohort, (p) => {
          const first = p.touches.find((t) => t.sequence === 1);
          return first?.approach
            ? { chave: first.approach.id, label: first.approach.name }
            : { chave: 'sem-abordagem', label: 'Sem abordagem registrada' };
        }),
        porResponsavel: this.cutBy(cohort, (p) =>
          p.owner
            ? { chave: p.owner.id, label: p.owner.name }
            : { chave: 'sem-dono', label: 'Sem responsável' },
        ),
        porNicho: this.cutBy(cohort, (p) => ({
          chave: p.niche ?? 'sem-nicho',
          label: p.niche ?? 'Sem nicho',
        })),
        porAnuncio: this.cutBy(cohort, (p) => ({
          chave: p.hasAds === null ? 'desconhecido' : String(p.hasAds),
          label: p.hasAds === null ? 'Não sabemos' : p.hasAds ? 'Anuncia' : 'Não anuncia',
        })),
        porCanal: this.cutBy(cohort, (p) => ({
          chave: p.channel,
          label: CHANNEL_LABEL[p.channel],
        })),
        porLista: this.cutBy(cohort, (p) =>
          p.list
            ? { chave: p.list.id, label: p.list.name }
            : { chave: 'sem-lista', label: 'Sem lista' },
        ),
      },
      motivosPerda: this.buildLostReasons(cohort, reasonName),
    };
  }

  // ─── Coorte ─────────────────────────────────────────────────

  // A coorte é definida pela DATA DA ABORDAGEM, não pela etapa atual.
  // Esta é a diferença central para a planilha (e para o dashboard de
  // leads): lá o funil conta quem está parado em cada etapa hoje, o que
  // mistura quem foi abordado ontem com quem foi abordado há um mês.
  private async loadCohort(orgId: string, filters: AnalyticsFilters): Promise<CohortProspect[]> {
    const where: Prisma.ProspectWhereInput = {
      organizationId: orgId,
      deletedAt: null,
      firstContactedAt: {
        not: null,
        ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
        ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
      },
      ...(filters.listId ? { listId: filters.listId } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
      ...(filters.channel ? { channel: filters.channel } : {}),
      ...(filters.hasAds !== undefined ? { hasAds: filters.hasAds } : {}),
      ...(filters.niche ? { niche: { equals: filters.niche, mode: 'insensitive' } } : {}),
    };

    return this.prisma.prospect.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true } },
        list: { select: { id: true, name: true } },
        touches: { include: { approach: { select: { id: true, name: true } } } },
      },
    });
  }

  // ─── Degraus ────────────────────────────────────────────────

  // Cada degrau conta quem ALGUM DIA atingiu o carimbo, não quem está
  // parado ali agora — por isso o funil nunca "perde" quem avançou.
  private buildSteps(cohort: CohortProspect[]): FunnelStep[] {
    const top = cohort.length;
    let prev = top;

    return STEP_DEFS.map((def, i) => {
      const count = cohort.filter((p) => p[def.key] != null).length;
      const step: FunnelStep = {
        key: def.key,
        label: def.label,
        count,
        // A planilha só mostrava uma das duas porcentagens. As duas
        // juntas separam "onde perdemos gente" de "quanto sobra no fim".
        pctFromPrev: i === 0 ? 100 : this.pct(count, prev),
        pctFromTop: this.pct(count, top),
      };
      prev = count;
      return step;
    });
  }

  private buildMetrics(cohort: CohortProspect[]) {
    const won = cohort.filter((p) => p.wonAt != null);
    const responded = cohort.filter((p) => p.respondedAt != null);
    const meetingSet = cohort.filter((p) => p.meetingSetAt != null).length;
    const meetingHeld = cohort.filter((p) => p.meetingHeldAt != null).length;

    const totalContratos = won.reduce((sum, p) => sum + p.dealValue, 0);

    const ciclos = won
      .filter((p) => p.firstContactedAt)
      .map((p) => this.diffDays(p.firstContactedAt!, p.wonAt!));

    const temposResposta = responded
      .filter((p) => p.firstContactedAt)
      .map((p) => this.diffHours(p.firstContactedAt!, p.respondedAt!));

    // Em qual toque a resposta chegou. É o número que decide se o
    // 3º follow-up paga o esforço.
    const toquesAteResposta = responded
      .map((p) => p.touches.find((t) => this.isReply(t.outcome))?.sequence)
      .filter((s): s is number => s != null);

    return {
      totalContratos,
      ticketMedio: won.length ? Math.round(totalContratos / won.length) : 0,
      fechamentos: won.length,
      cicloMedioDias: this.avg(ciclos),
      tempoMedioAteRespostaHoras: this.avg(temposResposta),
      // A planilha tinha "Agendou reunião" e "Fez reunião" lado a lado
      // e nunca calculava o buraco entre os dois.
      noShowRate: meetingSet ? this.pct(meetingSet - meetingHeld, meetingSet) : 0,
      toquesMedioAteResposta: this.avg(toquesAteResposta),
      toquesMedios: this.avg(cohort.map((p) => p.touchCount)),
    };
  }

  // ─── Resposta por número de toque ───────────────────────────

  // A métrica-âncora. A planilha tinha as colunas de FUP 1..3 quase
  // todas vazias — ou seja, a operação parava no primeiro toque e os
  // 5,26% de resposta mediam isso, não a prospecção do time.
  private buildByTouchNumber(cohort: CohortProspect[]) {
    const bySeq = new Map<number, { enviados: number; respostas: number }>();

    for (const p of cohort) {
      for (const t of p.touches) {
        const row = bySeq.get(t.sequence) ?? { enviados: 0, respostas: 0 };
        row.enviados += 1;
        if (this.isReply(t.outcome)) row.respostas += 1;
        bySeq.set(t.sequence, row);
      }
    }

    return [...bySeq.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([sequence, row]) => ({
        sequence,
        label: sequence === 1 ? 'Abordagem' : `FUP ${sequence - 1}`,
        enviados: row.enviados,
        respostas: row.respostas,
        taxaResposta: this.pct(row.respostas, row.enviados),
        amostraSuficiente: row.enviados >= MIN_SAMPLE,
      }));
  }

  // ─── Cortes ─────────────────────────────────────────────────

  private cutBy(
    cohort: CohortProspect[],
    keyOf: (p: CohortProspect) => { chave: string; label: string },
  ): CutRow[] {
    const groups = new Map<string, { label: string; items: CohortProspect[] }>();

    for (const p of cohort) {
      const { chave, label } = keyOf(p);
      const group = groups.get(chave) ?? { label, items: [] };
      group.items.push(p);
      groups.set(chave, group);
    }

    return [...groups.entries()]
      .map(([chave, { label, items }]) => {
        const respostas = items.filter((p) => p.respondedAt != null).length;
        const fechamentos = items.filter((p) => p.wonAt != null).length;
        return {
          chave,
          label,
          abordados: items.length,
          respostas,
          reunioesAgendadas: items.filter((p) => p.meetingSetAt != null).length,
          reunioesFeitas: items.filter((p) => p.meetingHeldAt != null).length,
          fechamentos,
          receita: items.reduce((sum, p) => sum + (p.wonAt ? p.dealValue : 0), 0),
          taxaResposta: this.pct(respostas, items.length),
          taxaFechamento: this.pct(fechamentos, items.length),
          amostraSuficiente: items.length >= MIN_SAMPLE,
        };
      })
      .sort((a, b) => b.abordados - a.abordados);
  }

  private buildLostReasons(cohort: CohortProspect[], names: Map<string, string>) {
    const lost = cohort.filter((p) => p.lostAt != null);
    const counts = new Map<string, number>();

    for (const p of lost) {
      const key = p.lostReasonId ?? 'sem-motivo';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([id, count]) => ({
        id,
        // Texto livre não agrega; o motivo vem do catálogo da org.
        nome: id === 'sem-motivo' ? 'Sem motivo registrado' : (names.get(id) ?? 'Motivo removido'),
        count,
        pct: this.pct(count, lost.length),
      }))
      .sort((a, b) => b.count - a.count);
  }

  // ─── Auxiliares ─────────────────────────────────────────────

  private isReply(outcome: string) {
    return outcome === 'REPLIED_POSITIVE' || outcome === 'REPLIED_NEGATIVE';
  }

  private pct(part: number, total: number) {
    if (!total) return 0;
    return Math.round((part / total) * 10000) / 100;
  }

  private avg(values: number[]) {
    if (!values.length) return 0;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  }

  private diffDays(from: Date, to: Date) {
    return (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
  }

  private diffHours(from: Date, to: Date) {
    return (to.getTime() - from.getTime()) / (60 * 60 * 1000);
  }
}
