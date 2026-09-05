import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertProspectListDto, UpsertApproachDto } from './dto/prospect-list.dto';

@Injectable()
export class ProspectListsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Listas / campanhas ─────────────────────────────────────

  async findAll(orgId: string, includeArchived = false) {
    const lists = await this.prisma.prospectList.findMany({
      where: {
        organizationId: orgId,
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { prospects: true } } },
    });

    return lists.map(({ _count, ...list }) => ({
      ...list,
      prospectCount: _count.prospects,
    }));
  }

  async create(orgId: string, userId: string, dto: UpsertProspectListDto) {
    return this.prisma.prospectList.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        description: dto.description,
        niche: dto.niche,
        ...(dto.cadenceDays ? { cadenceDays: dto.cadenceDays } : {}),
        createdBy: userId,
      },
    });
  }

  async update(orgId: string, id: string, dto: UpsertProspectListDto) {
    const list = await this.prisma.prospectList.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!list) throw new NotFoundException('Lista nao encontrada');

    return this.prisma.prospectList.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.niche !== undefined ? { niche: dto.niche } : {}),
        ...(dto.cadenceDays !== undefined ? { cadenceDays: dto.cadenceDays } : {}),
        ...(dto.archived !== undefined
          ? { archivedAt: dto.archived ? new Date() : null }
          : {}),
      },
    });
  }

  // Os prospects sobrevivem à lista (FK com SET NULL): apagar a campanha
  // não pode apagar o histórico que alimenta o funil.
  async remove(orgId: string, id: string) {
    const list = await this.prisma.prospectList.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!list) throw new NotFoundException('Lista nao encontrada');
    await this.prisma.prospectList.delete({ where: { id } });
  }

  // ─── Abordagens (scripts) ───────────────────────────────────

  async findApproaches(orgId: string) {
    return this.prisma.prospectApproach.findMany({
      where: { organizationId: orgId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }

  async createApproach(orgId: string, dto: UpsertApproachDto) {
    const exists = await this.prisma.prospectApproach.findFirst({
      where: { organizationId: orgId, name: dto.name },
    });
    if (exists) throw new ConflictException('Ja existe uma abordagem com este nome');

    return this.prisma.prospectApproach.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        body: dto.body,
        position: dto.position ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateApproach(orgId: string, id: string, dto: UpsertApproachDto) {
    const approach = await this.prisma.prospectApproach.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!approach) throw new NotFoundException('Abordagem nao encontrada');

    return this.prisma.prospectApproach.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  // Desativa em vez de apagar quando a abordagem já foi usada: o corte
  // "conversão por script" precisa do vínculo histórico para existir.
  async removeApproach(orgId: string, id: string) {
    const approach = await this.prisma.prospectApproach.findFirst({
      where: { id, organizationId: orgId },
      include: { _count: { select: { touches: true } } },
    });
    if (!approach) throw new NotFoundException('Abordagem nao encontrada');

    if (approach._count.touches > 0) {
      return this.prisma.prospectApproach.update({
        where: { id },
        data: { isActive: false },
      });
    }

    await this.prisma.prospectApproach.delete({ where: { id } });
    return null;
  }
}
