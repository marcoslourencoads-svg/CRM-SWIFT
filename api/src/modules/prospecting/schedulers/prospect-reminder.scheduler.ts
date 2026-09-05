import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

/**
 * Lembrete de compromisso da prospecção: roda a cada 5 minutos.
 *
 * O caso real que motivou isto: "o cliente pediu para retornar terça".
 * Antes, a única forma de lembrar era abrir a Fila do dia e reparar que
 * o prospect estava atrasado — ou seja, o aviso só chegava depois de já
 * ter passado da hora.
 *
 * Aqui o `nextActionAt` vira um compromisso de verdade: 30 minutos antes
 * da hora marcada, o dono recebe a notificação no sino.
 *
 * Espelha o TaskReminderScheduler das tarefas de lead, inclusive na
 * guarda contra repetição.
 */
@Injectable()
export class ProspectReminderScheduler {
  private readonly logger = new Logger(ProspectReminderScheduler.name);

  private static readonly JANELA_MIN = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async avisarCompromissosProximos() {
    const agora = new Date();
    const limite = new Date(agora.getTime() + ProspectReminderScheduler.JANELA_MIN * 60 * 1000);

    const proximos = await this.prisma.prospect.findMany({
      where: {
        deletedAt: null,
        ownerId: { not: null },
        stage: { notIn: ['WON', 'LOST', 'DISQUALIFIED'] },
        nextActionAt: { gte: agora, lt: limite },
      },
      select: {
        id: true,
        organizationId: true,
        ownerId: true,
        name: true,
        business: true,
        nextActionAt: true,
        touchCount: true,
      },
      take: 200,
    });

    let avisados = 0;

    for (const p of proximos) {
      if (!p.ownerId) continue;

      // Sem esta guarda o cron de 5 em 5 minutos avisaria o mesmo
      // compromisso seis vezes dentro da janela de 30 minutos.
      const jaAvisado = await this.prisma.notification.findFirst({
        where: {
          recipientId: p.ownerId,
          type: 'PROSPECT_DUE',
          createdAt: { gt: new Date(agora.getTime() - 6 * 60 * 60 * 1000) },
          metadata: { path: ['prospectId'], equals: p.id },
        },
      });
      if (jaAvisado) continue;

      const quem = p.business?.trim() || p.name;
      const hora = p.nextActionAt!.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      await this.notifications.create(
        p.organizationId,
        p.ownerId,
        'PROSPECT_DUE',
        `Retornar para ${quem} às ${hora}`,
        p.touchCount === 0
          ? 'Primeira abordagem combinada para agora.'
          : `Combinado depois de ${p.touchCount} toque${p.touchCount === 1 ? '' : 's'}.`,
        { prospectId: p.id, nextActionAt: p.nextActionAt },
      );
      avisados++;
    }

    if (avisados > 0) {
      this.logger.log(`Compromissos de prospeccao avisados: ${avisados}`);
    }
  }
}
