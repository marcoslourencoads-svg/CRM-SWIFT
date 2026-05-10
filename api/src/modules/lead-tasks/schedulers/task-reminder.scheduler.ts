import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

/**
 * Lembrete de tarefa: roda a cada 5 minutos.
 *
 * Pra tarefas com dueDate vencendo nos próximos 60 min e ainda não notificadas,
 * cria notification TASK_DUE pro assignee.
 */
@Injectable()
export class TaskReminderScheduler {
  private readonly logger = new Logger(TaskReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async remindUpcomingTasks() {
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

    const upcoming = await this.prisma.leadTask.findMany({
      where: {
        completedAt: null,
        dueDate: { gte: now, lt: inOneHour },
      },
      include: {
        lead: { select: { id: true, title: true, organizationId: true } },
      },
      take: 200,
    });

    let notified = 0;

    for (const task of upcoming) {
      const already = await this.prisma.notification.findFirst({
        where: {
          recipientId: task.assigneeId,
          type: 'TASK_DUE',
          createdAt: { gt: new Date(now.getTime() - 60 * 60 * 1000) },
          metadata: { path: ['taskId'], equals: task.id },
        },
      });
      if (already) continue;

      await this.notifications.create(
        task.lead.organizationId,
        task.assigneeId,
        'TASK_DUE',
        `Tarefa vence em 1h: ${task.title}`,
        `Em "${task.lead.title}".`,
        { taskId: task.id, leadId: task.leadId },
      );
      notified++;
    }

    if (notified > 0) {
      this.logger.log(`Task reminder: notified ${notified} tasks`);
    }
  }
}
