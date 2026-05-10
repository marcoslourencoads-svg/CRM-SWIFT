import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

/**
 * Marca leads como "stale" quando ficam parados num status acima do
 * `staleAfterDays` configurado no PipelineStatus. Roda 1x por hora.
 *
 * Regra: lead.lastStatusChangedAt < now - staleAfterDays dias
 *   → cria notification pro assignee (se houver)
 *   → emite evento `lead.stale` (consumido futuramente pela engine de automação)
 */
@Injectable()
export class StaleLeadsDetectorScheduler {
  private readonly logger = new Logger(StaleLeadsDetectorScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async detectStaleLeads() {
    const startedAt = Date.now();

    const statusesWithStaleConfig = await this.prisma.pipelineStatus.findMany({
      where: { staleAfterDays: { not: null } },
      select: { id: true, name: true, staleAfterDays: true, pipelineId: true },
    });

    if (statusesWithStaleConfig.length === 0) return;

    let totalNotified = 0;

    for (const status of statusesWithStaleConfig) {
      const days = status.staleAfterDays!;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const staleLeads = await this.prisma.lead.findMany({
        where: {
          statusId: status.id,
          deletedAt: null,
          lastStatusChangedAt: { lt: cutoff },
          assigneeId: { not: null },
        },
        select: { id: true, title: true, assigneeId: true, organizationId: true },
        take: 100,
      });

      for (const lead of staleLeads) {
        if (!lead.assigneeId) continue;

        // Evita duplicar notificação: só cria se não houver LEAD_STALE nas últimas 24h
        const recentNotif = await this.prisma.notification.findFirst({
          where: {
            recipientId: lead.assigneeId,
            type: 'LEAD_STALE',
            createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            metadata: { path: ['leadId'], equals: lead.id },
          },
        });
        if (recentNotif) continue;

        await this.notifications.create(
          lead.organizationId,
          lead.assigneeId,
          'LEAD_STALE',
          `Lead parado há ${days} dias`,
          `${lead.title} está em "${status.name}" sem mover.`,
          { leadId: lead.id, statusId: status.id, daysStale: days },
        );
        totalNotified++;
      }
    }

    const elapsed = Date.now() - startedAt;
    if (totalNotified > 0) {
      this.logger.log(
        `Stale detector: ${totalNotified} leads notified in ${elapsed}ms`,
      );
    }
  }
}
