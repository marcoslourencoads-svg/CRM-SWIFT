import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── KPIs ──────────────────────────────────────────────────

  async getKpis(
    orgId: string,
    pipelineId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const pipelineFilter = pipelineId ? { pipelineId } : {};
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);

    // Fetch all statuses for the org's pipelines (to map flags)
    const statuses = await this.prisma.pipelineStatus.findMany({
      where: {
        pipeline: { organizationId: orgId },
        ...(pipelineId ? { pipelineId } : {}),
      },
    });

    const mqls = statuses.filter((s) => s.isMql).map((s) => s.id);
    const meetings = statuses.filter((s) => s.isMeeting).map((s) => s.id);
    const finals = statuses.filter((s) => s.isFinal).map((s) => s.id);
    const wons = statuses
      .filter((s) => s.isFinal && s.isWon)
      .map((s) => s.id);
    const disqualifiedIds = statuses
      .filter((s) => s.isFinal && !s.isWon)
      .map((s) => s.id);

    const baseWhere = {
      organizationId: orgId,
      deletedAt: null,
      ...pipelineFilter,
    };

    // Merge date constraints: for leadsToday/leadsMonth we need BOTH the
    // hardcoded start AND any upper-bound from the period filter.
    const dateUpper = dateFilter.createdAt
      ? { ...(dateFilter.createdAt.lt ? { lt: dateFilter.createdAt.lt } : {}),
          ...(dateFilter.createdAt.lte ? { lte: dateFilter.createdAt.lte } : {}) }
      : {};

    // Parallel queries
    const [
      leadsToday,
      leadsMonth,
      mqlCount,
      disqualifiedCount,
      meetingsScheduled,
      salesCount,
      salesRevenue,
      meetingLeads,
      allLeads,
    ] = await Promise.all([
      // Leads created today (keep todayStart, only add upper-bound from period)
      this.prisma.lead.count({
        where: { ...baseWhere, createdAt: { gte: todayStart, ...dateUpper } },
      }),
      // Leads created this month (keep monthStart, only add upper-bound from period)
      this.prisma.lead.count({
        where: { ...baseWhere, createdAt: { gte: monthStart, ...dateUpper } },
      }),
      // MQLs (leads currently in MQL status)
      mqls.length > 0
        ? this.prisma.lead.count({
            where: { ...baseWhere, statusId: { in: mqls }, ...dateFilter },
          })
        : 0,
      // Disqualified (leads in final non-won statuses)
      disqualifiedIds.length > 0
        ? this.prisma.lead.count({
            where: {
              ...baseWhere,
              statusId: { in: disqualifiedIds },
              ...dateFilter,
            },
          })
        : 0,
      // Meetings scheduled (leads that reached meeting status)
      meetings.length > 0
        ? this.prisma.lead.count({
            where: {
              ...baseWhere,
              statusId: { in: meetings },
              ...dateFilter,
            },
          })
        : 0,
      // Sales (won leads)
      wons.length > 0
        ? this.prisma.lead.count({
            where: { ...baseWhere, statusId: { in: wons }, ...dateFilter },
          })
        : 0,
      // Revenue from won leads
      wons.length > 0
        ? this.prisma.lead.aggregate({
            where: { ...baseWhere, statusId: { in: wons }, ...dateFilter },
            _sum: { estimatedValue: true },
          })
        : { _sum: { estimatedValue: 0 } },
      // Leads that reached meeting stage (for conversion calc)
      meetings.length > 0
        ? this.prisma.lead.count({
            where: {
              ...baseWhere,
              statusId: { in: [...meetings, ...finals] },
              ...dateFilter,
            },
          })
        : 0,
      // All leads (for full funnel conversion)
      this.prisma.lead.count({
        where: { ...baseWhere, ...dateFilter },
      }),
    ]);

    // Revenue grouped by status
    const revenueByStatus = await this.prisma.lead.groupBy({
      by: ['statusId'],
      where: { ...baseWhere, ...dateFilter },
      _sum: { estimatedValue: true },
      _count: true,
    });

    // Enrich with status names
    const statusMap = new Map(statuses.map((s) => [s.id, s.name]));
    const revenueByStatusMapped = revenueByStatus.map((r) => ({
      statusId: r.statusId,
      statusName: statusMap.get(r.statusId) || r.statusId,
      count: r._count,
      totalValue: r._sum.estimatedValue || 0,
    }));

    // Conversion rates
    const conversionMeetingToClose =
      meetingLeads > 0 ? salesCount / meetingLeads : 0;
    const conversionFullFunnel = allLeads > 0 ? salesCount / allLeads : 0;

    return {
      leadsToday,
      leadsMonth,
      mqls: mqlCount,
      disqualified: disqualifiedCount,
      meetingsScheduled,
      sales: salesCount,
      salesRevenue: salesRevenue._sum.estimatedValue || 0,
      revenueByStatus: revenueByStatusMapped,
      conversionMeetingToClose: Math.round(conversionMeetingToClose * 10000) / 100,
      conversionFullFunnel: Math.round(conversionFullFunnel * 10000) / 100,
    };
  }

  // ─── CPL (Cost Per Lead) ───────────────────────────────────

  async getCpl(orgId: string, month?: string) {
    const targetMonth =
      month || new Date().toISOString().slice(0, 7); // YYYY-MM

    const monthStart = new Date(`${targetMonth}-01T00:00:00.000Z`);
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const [investments, leadCount] = await Promise.all([
      this.prisma.monthlyInvestment.findMany({
        where: { organizationId: orgId, month: targetMonth },
      }),
      this.prisma.lead.count({
        where: {
          organizationId: orgId,
          deletedAt: null,
          createdAt: { gte: monthStart, lt: nextMonth },
        },
      }),
    ]);

    const totalInvestment = investments.reduce((sum: number, i: any) => sum + i.amount, 0);
    const cpl = leadCount > 0 ? totalInvestment / leadCount : 0;

    return {
      month: targetMonth,
      totalInvestment,
      leadCount,
      cpl: Math.round(cpl),
      investments,
    };
  }

  // ─── Funnel ────────────────────────────────────────────────

  async getFunnel(orgId: string, pipelineId: string) {
    const statuses = await this.prisma.pipelineStatus.findMany({
      where: { pipelineId },
      orderBy: { position: 'asc' },
    });

    const counts = await this.prisma.lead.groupBy({
      by: ['statusId'],
      where: {
        organizationId: orgId,
        pipelineId,
        deletedAt: null,
      },
      _count: true,
    });

    const countMap = new Map(counts.map((c) => [c.statusId, c._count]));

    const steps = statuses.map((s, i) => {
      const count = countMap.get(s.id) || 0;
      const prevCount =
        i === 0 ? count : countMap.get(statuses[i - 1].id) || 0;
      const conversionFromPrev =
        i === 0 || prevCount === 0
          ? 100
          : Math.round((count / prevCount) * 10000) / 100;

      return {
        statusId: s.id,
        statusName: s.name,
        color: s.color,
        position: s.position,
        count,
        conversionFromPrev,
        isMql: s.isMql,
        isMeeting: s.isMeeting,
        isFinal: s.isFinal,
        isWon: s.isWon,
      };
    });

    const totalLeads = steps.reduce((sum, s) => sum + s.count, 0);

    return { pipelineId, totalLeads, steps };
  }

  // ─── Insights ──────────────────────────────────────────────

  /**
   * Performance por fonte de origem. Pra cada source da org:
   * - leads (total criados no período)
   * - wins (quantos viraram ganho)
   * - revenue (soma de estimatedValue dos wins)
   * - conversionRate (%)
   */
  async bySource(orgId: string, pipelineId?: string, dateFrom?: string, dateTo?: string) {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);
    const baseWhere: any = {
      organizationId: orgId,
      deletedAt: null,
      ...(pipelineId ? { pipelineId } : {}),
      ...dateFilter,
    };

    const sources = await this.prisma.leadSource.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true, color: true },
    });

    const result = await Promise.all(
      sources.map(async (src) => {
        const where = { ...baseWhere, sourceId: src.id };
        const [leads, wonLeads] = await Promise.all([
          this.prisma.lead.count({ where }),
          this.prisma.lead.findMany({
            where: { ...where, status: { isWon: true } },
            select: { estimatedValue: true },
          }),
        ]);
        const wins = wonLeads.length;
        const revenue = wonLeads.reduce((s, l) => s + (l.estimatedValue ?? 0), 0);
        const conversionRate = leads > 0 ? Math.round((wins / leads) * 10000) / 100 : 0;
        return {
          sourceId: src.id,
          sourceName: src.name,
          sourceColor: src.color,
          leads,
          wins,
          revenue,
          conversionRate,
        };
      }),
    );

    return result.sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Forecast: soma de (estimatedValue × probability/100) dos leads em aberto
   * (não won/lost), agrupado por status.
   */
  async forecast(orgId: string, pipelineId?: string) {
    const where: any = {
      organizationId: orgId,
      deletedAt: null,
      status: { isFinal: false },
      ...(pipelineId ? { pipelineId } : {}),
    };

    const leads = await this.prisma.lead.findMany({
      where,
      select: {
        estimatedValue: true,
        probability: true,
        status: { select: { id: true, name: true, color: true } },
      },
    });

    const byStatusMap = new Map<string, { statusName: string; statusColor: string; forecast: number; count: number }>();
    let totalForecast = 0;

    for (const l of leads) {
      const value = l.estimatedValue ?? 0;
      const prob = l.probability ?? 50; // default 50% se não definido
      const partial = value * (prob / 100);
      totalForecast += partial;

      const key = l.status.id;
      const existing = byStatusMap.get(key);
      if (existing) {
        existing.forecast += partial;
        existing.count += 1;
      } else {
        byStatusMap.set(key, {
          statusName: l.status.name,
          statusColor: l.status.color,
          forecast: partial,
          count: 1,
        });
      }
    }

    return {
      totalForecast: Math.round(totalForecast),
      byStatus: Array.from(byStatusMap.values())
        .map((s) => ({ ...s, forecast: Math.round(s.forecast) }))
        .sort((a, b) => b.forecast - a.forecast),
    };
  }

  /**
   * Tempo médio que cada lead passa em cada etapa (em dias).
   * Aproximação: usa activities de tipo STATUS_CHANGED do audit pra inferir
   * entrada/saída. Se não houver evento de saída, considera lead ainda lá.
   */
  async avgTimePerStage(orgId: string, pipelineId?: string) {
    const statuses = await this.prisma.pipelineStatus.findMany({
      where: {
        pipeline: { organizationId: orgId },
        ...(pipelineId ? { pipelineId } : {}),
      },
      orderBy: { position: 'asc' },
      select: { id: true, name: true, color: true, position: true },
    });

    if (statuses.length === 0) return [];

    // Buscar todas as atividades de mudança de status
    const moves = await this.prisma.activity.findMany({
      where: {
        type: 'STATUS_CHANGED',
        lead: {
          organizationId: orgId,
          deletedAt: null,
          ...(pipelineId ? { pipelineId } : {}),
        },
      },
      select: {
        leadId: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Agrupa por lead
    const byLead = new Map<string, typeof moves>();
    for (const m of moves) {
      const list = byLead.get(m.leadId) ?? [];
      list.push(m);
      byLead.set(m.leadId, list);
    }

    // Pra cada lead, calcula intervalo de tempo entre mudanças
    const stageTotals = new Map<string, { totalMs: number; samples: number }>();

    for (const [, leadMoves] of byLead) {
      for (let i = 0; i < leadMoves.length - 1; i++) {
        const cur = leadMoves[i];
        const next = leadMoves[i + 1];
        const meta = (cur.metadata as any) ?? {};
        const toStatusId = meta.toStatusId ?? meta.statusId;
        if (!toStatusId) continue;
        const elapsed = next.createdAt.getTime() - cur.createdAt.getTime();
        const existing = stageTotals.get(toStatusId);
        if (existing) {
          existing.totalMs += elapsed;
          existing.samples += 1;
        } else {
          stageTotals.set(toStatusId, { totalMs: elapsed, samples: 1 });
        }
      }
    }

    return statuses.map((s) => {
      const t = stageTotals.get(s.id);
      const avgDays = t && t.samples > 0
        ? Math.round((t.totalMs / t.samples / (1000 * 60 * 60 * 24)) * 10) / 10
        : 0;
      return {
        statusId: s.id,
        statusName: s.name,
        statusColor: s.color,
        position: s.position,
        avgDays,
        samples: t?.samples ?? 0,
      };
    });
  }

  /**
   * Agrega os 3 insights num único response.
   */
  async insights(orgId: string, pipelineId?: string, dateFrom?: string, dateTo?: string) {
    const [bySource, forecast, avgTimePerStage] = await Promise.all([
      this.bySource(orgId, pipelineId, dateFrom, dateTo),
      this.forecast(orgId, pipelineId),
      this.avgTimePerStage(orgId, pipelineId),
    ]);
    return { bySource, forecast, avgTimePerStage };
  }

  // ─── Helpers ───────────────────────────────────────────────

  private buildDateFilter(dateFrom?: string, dateTo?: string) {
    if (!dateFrom && !dateTo) return {};
    const filter: any = {};
    if (dateFrom) filter.createdAt = { gte: new Date(dateFrom) };
    if (dateTo) {
      // Use start of NEXT day so the entire dateTo day is included
      const endOfDay = new Date(dateTo);
      endOfDay.setDate(endOfDay.getDate() + 1);
      filter.createdAt = {
        ...filter.createdAt,
        lt: endOfDay,
      };
    }
    return filter;
  }
}
