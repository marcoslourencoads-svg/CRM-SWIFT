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
    // Verify lead belongs to the org
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
}
