import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface UpsertSavedViewDto {
  name: string;
  pipelineId?: string | null;
  filters: Record<string, unknown>;
  isShared?: boolean;
}

@Injectable()
export class SavedViewsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(orgId: string, userId: string) {
    return this.prisma.savedView.findMany({
      where: {
        organizationId: orgId,
        OR: [{ userId }, { isShared: true }],
      },
      orderBy: [{ isShared: 'asc' }, { name: 'asc' }],
    });
  }

  create(orgId: string, userId: string, dto: UpsertSavedViewDto) {
    return this.prisma.savedView.create({
      data: {
        organizationId: orgId,
        userId,
        name: dto.name,
        pipelineId: dto.pipelineId ?? null,
        filters: dto.filters as any,
        isShared: dto.isShared ?? false,
      },
    });
  }

  async update(orgId: string, userId: string, id: string, dto: Partial<UpsertSavedViewDto>) {
    const view = await this.prisma.savedView.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!view) throw new NotFoundException('Lista não encontrada');
    if (view.userId !== userId && !view.isShared) {
      throw new ForbiddenException('Apenas o autor pode editar listas privadas');
    }

    return this.prisma.savedView.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.pipelineId !== undefined ? { pipelineId: dto.pipelineId } : {}),
        ...(dto.filters !== undefined ? { filters: dto.filters as any } : {}),
        ...(dto.isShared !== undefined ? { isShared: dto.isShared } : {}),
      },
    });
  }

  async remove(orgId: string, userId: string, id: string) {
    const view = await this.prisma.savedView.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!view) throw new NotFoundException('Lista não encontrada');
    if (view.userId !== userId) {
      throw new ForbiddenException('Apenas o autor pode apagar a lista');
    }
    return this.prisma.savedView.delete({ where: { id } });
  }
}
