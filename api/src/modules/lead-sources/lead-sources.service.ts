import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeadSourceDto } from './dto/create-lead-source.dto';
import { UpdateLeadSourceDto } from './dto/update-lead-source.dto';

@Injectable()
export class LeadSourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string) {
    return this.prisma.leadSource.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async create(orgId: string, dto: CreateLeadSourceDto) {
    // If setting as default, unset current default first
    if (dto.isDefault) {
      await this.prisma.leadSource.updateMany({
        where: { organizationId: orgId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.leadSource.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        type: dto.type,
        color: dto.color,
        icon: dto.icon,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async update(orgId: string, id: string, dto: UpdateLeadSourceDto) {
    const source = await this.prisma.leadSource.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!source) throw new NotFoundException('Lead source not found');

    // If setting as default, unset current default first
    if (dto.isDefault) {
      await this.prisma.leadSource.updateMany({
        where: { organizationId: orgId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.leadSource.update({
      where: { id },
      data: dto,
    });
  }

  async remove(orgId: string, id: string) {
    const source = await this.prisma.leadSource.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!source) throw new NotFoundException('Lead source not found');

    return this.prisma.leadSource.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async report(orgId: string) {
    const results = await this.prisma.lead.groupBy({
      by: ['sourceId'],
      where: {
        organizationId: orgId,
        deletedAt: null,
        sourceId: { not: null },
      },
      _count: { id: true },
      _sum: { estimatedValue: true },
    });

    // Fetch source details for the grouped results
    const sourceIds = results
      .map((r) => r.sourceId)
      .filter((id): id is string => id !== null);

    const sources = await this.prisma.leadSource.findMany({
      where: { id: { in: sourceIds } },
    });

    const sourceMap = new Map(sources.map((s) => [s.id, s]));

    return results.map((r) => ({
      source: sourceMap.get(r.sourceId!) ?? null,
      leadsCount: r._count.id,
      totalEstimatedValue: r._sum.estimatedValue ?? 0,
    }));
  }
}
