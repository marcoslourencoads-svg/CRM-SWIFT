import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType, Prisma } from '@prisma/client';
import { NotificationsPublisher } from './notifications.publisher';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: NotificationsPublisher,
  ) {}

  async create(
    orgId: string,
    recipientId: string,
    type: NotificationType,
    title: string,
    body: string,
    metadata?: Record<string, unknown>,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        organizationId: orgId,
        recipientId,
        type,
        title,
        body,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    // Push real-time pro recipient (se estiver conectado via SSE)
    this.publisher.publish(recipientId, 'notification.created', notification);

    return notification;
  }

  async findByUser(userId: string, cursor?: string, limit = 20) {
    return this.prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    });
    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, recipientId: userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async getPreferences(userId: string) {
    return this.prisma.notificationPreference.findMany({
      where: { userId },
    });
  }

  async updatePreferences(
    userId: string,
    eventType: NotificationType,
    inApp?: boolean,
    email?: boolean,
  ) {
    return this.prisma.notificationPreference.upsert({
      where: {
        userId_eventType: { userId, eventType },
      },
      update: {
        ...(inApp !== undefined ? { inApp } : {}),
        ...(email !== undefined ? { email } : {}),
      },
      create: {
        userId,
        eventType,
        inApp: inApp ?? true,
        email: email ?? false,
      },
    });
  }
}
