import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Lógica de permissão por pipeline. Por default:
 * - Usuário sem PipelineMembership na pipeline: comportamento da role global
 *   (OWNER/ADMIN/MANAGER veem tudo; MEMBER vê só os próprios leads atribuídos)
 * - Com PipelineMembership: usa os flags canEdit/canSeeAllLeads
 */
@Injectable()
export class PipelinePermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEffectivePermissions(
    userId: string,
    pipelineId: string,
    role: string,
  ): Promise<{ canEdit: boolean; canSeeAllLeads: boolean }> {
    const membership = await this.prisma.pipelineMembership.findUnique({
      where: { pipelineId_userId: { pipelineId, userId } },
    });

    if (membership) {
      return {
        canEdit: membership.canEdit,
        canSeeAllLeads: membership.canSeeAllLeads,
      };
    }

    // Default por role:
    const isPrivileged = role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER';
    return {
      canEdit: true,
      canSeeAllLeads: isPrivileged,
    };
  }

  list(pipelineId: string) {
    return this.prisma.pipelineMembership.findMany({
      where: { pipelineId },
    });
  }

  upsert(
    pipelineId: string,
    userId: string,
    canEdit: boolean,
    canSeeAllLeads: boolean,
  ) {
    return this.prisma.pipelineMembership.upsert({
      where: { pipelineId_userId: { pipelineId, userId } },
      update: { canEdit, canSeeAllLeads },
      create: { pipelineId, userId, canEdit, canSeeAllLeads },
    });
  }

  remove(pipelineId: string, userId: string) {
    return this.prisma.pipelineMembership.deleteMany({
      where: { pipelineId, userId },
    });
  }
}
