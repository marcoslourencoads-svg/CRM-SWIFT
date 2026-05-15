import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityType, Prisma } from '@prisma/client';

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async logActivity(
    leadId: string,
    userId: string | null,
    type: ActivityType,
    metadata: Prisma.InputJsonValue = {},
  ) {
    return this.prisma.activity.create({
      data: { leadId, userId, type, metadata },
    });
  }

  async getByLead(
    orgId: string,
    leadId: string,
    cursor?: string,
    limit = 20,
  ) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    return this.prisma.activity.findMany({
      where: { leadId },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  }

  async listForOrg(
    orgId: string,
    filters: {
      userId?: string;
      type?: string;
      dateFrom?: string;
      dateTo?: string;
      cursor?: string;
      limit: number;
    },
  ) {
    const where: any = {
      lead: { organizationId: orgId },
    };
    if (filters.userId) where.userId = filters.userId;
    if (filters.type) where.type = filters.type as ActivityType;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    return this.prisma.activity.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        lead: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
      ...(filters.cursor ? { skip: 1, cursor: { id: filters.cursor } } : {}),
    });
  }
}
