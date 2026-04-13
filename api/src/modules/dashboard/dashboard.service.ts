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
