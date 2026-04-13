import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { UpdatePipelineDto } from './dto/update-pipeline.dto';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ReorderStatusesDto } from './dto/reorder-statuses.dto';
import { CreateTransitionRuleDto } from './dto/create-transition-rule.dto';

const DEFAULT_STATUSES = [
  { name: 'Novo', color: '#6B7280', isDefault: true, position: 0 },
  { name: 'Em contato', color: '#3B82F6', position: 1 },
  { name: 'Qualificado', color: '#8B5CF6', isMql: true, position: 2 },
  { name: 'Reunião agendada', color: '#F59E0B', isMeeting: true, position: 3 },
  { name: 'Ganho', color: '#10B981', isFinal: true, isWon: true, position: 4 },
  { name: 'Perdido', color: '#EF4444', isFinal: true, isWon: false, position: 5 },
];

@Injectable()
export class PipelinesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Pipelines ──────────────────────────────────────────

  async create(orgId: string, dto: CreatePipelineDto) {
    const count = await this.prisma.pipeline.count({
      where: { organizationId: orgId, deletedAt: null },
    });

    return this.prisma.pipeline.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        description: dto.description,
        position: count,
        statuses: {
          create: DEFAULT_STATUSES,
        },
      },
      include: { statuses: { orderBy: { position: 'asc' } } },
    });
  }

  async findAll(orgId: string) {
    return this.prisma.pipeline.findMany({
      where: { organizationId: orgId, deletedAt: null },
      include: {
        statuses: { orderBy: { position: 'asc' } },
        _count: { select: { statuses: true } },
      },
      orderBy: { position: 'asc' },
    });
  }

  async findOne(orgId: string, id: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        statuses: { orderBy: { position: 'asc' } },
        transitionRules: true,
      },
    });
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    return pipeline;
  }

  async update(orgId: string, id: string, dto: UpdatePipelineDto) {
    await this.findOne(orgId, id);
    return this.prisma.pipeline.update({
      where: { id },
      data: dto,
      include: { statuses: { orderBy: { position: 'asc' } } },
    });
  }

  async remove(orgId: string, id: string) {
    await this.findOne(orgId, id);
    return this.prisma.pipeline.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Statuses ───────────────────────────────────────────

  async createStatus(orgId: string, pipelineId: string, dto: CreateStatusDto) {
    const pipeline = await this.findOne(orgId, pipelineId);
    const maxPosition = pipeline.statuses.length;

    return this.prisma.pipelineStatus.create({
      data: {
        pipelineId,
        name: dto.name,
        color: dto.color || '#6B7280',
        position: maxPosition,
        isFinal: dto.isFinal || false,
        isWon: dto.isWon || false,
        isMql: dto.isMql || false,
        isMeeting: dto.isMeeting || false,
        staleAfterDays: dto.staleAfterDays,
      },
    });
  }

  async updateStatus(orgId: string, statusId: string, dto: UpdateStatusDto) {
    const status = await this.prisma.pipelineStatus.findUnique({
      where: { id: statusId },
      include: { pipeline: true },
    });
    if (!status || status.pipeline.organizationId !== orgId) {
      throw new NotFoundException('Status not found');
    }

    // If setting as default, unset current default
    if (dto.isDefault) {
      await this.prisma.pipelineStatus.updateMany({
        where: { pipelineId: status.pipelineId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.pipelineStatus.update({
      where: { id: statusId },
      data: dto,
    });
  }

  async deleteStatus(orgId: string, statusId: string) {
    const status = await this.prisma.pipelineStatus.findUnique({
      where: { id: statusId },
      include: { pipeline: true },
    });
    if (!status || status.pipeline.organizationId !== orgId) {
      throw new NotFoundException('Status not found');
    }

    if (status.isDefault) {
      throw new BadRequestException('Cannot delete the default status. Set another as default first.');
    }

    // Count statuses in pipeline — must keep at least 1
    const count = await this.prisma.pipelineStatus.count({
      where: { pipelineId: status.pipelineId },
    });
    if (count <= 1) {
      throw new BadRequestException('Pipeline must have at least one status');
    }

    return this.prisma.pipelineStatus.delete({ where: { id: statusId } });
  }

  async reorderStatuses(orgId: string, pipelineId: string, dto: ReorderStatusesDto) {
    await this.findOne(orgId, pipelineId);

    const updates = dto.statusIds.map((id, index) =>
      this.prisma.pipelineStatus.update({
        where: { id },
        data: { position: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.prisma.pipelineStatus.findMany({
      where: { pipelineId },
      orderBy: { position: 'asc' },
    });
  }

  // ─── Transition Rules ───────────────────────────────────

  async createTransitionRule(orgId: string, pipelineId: string, dto: CreateTransitionRuleDto) {
    await this.findOne(orgId, pipelineId);

    const existing = await this.prisma.transitionRule.findUnique({
      where: {
        pipelineId_fromStatusId_toStatusId: {
          pipelineId,
          fromStatusId: dto.fromStatusId,
          toStatusId: dto.toStatusId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('Transition rule already exists');
    }

    return this.prisma.transitionRule.create({
      data: {
        pipelineId,
        fromStatusId: dto.fromStatusId,
        toStatusId: dto.toStatusId,
        isAllowed: dto.isAllowed ?? true,
        requiredFields: dto.requiredFields || [],
      },
    });
  }

  async getTransitionRules(orgId: string, pipelineId: string) {
    await this.findOne(orgId, pipelineId);
    return this.prisma.transitionRule.findMany({
      where: { pipelineId },
      include: { fromStatus: true, toStatus: true },
    });
  }

  async deleteTransitionRule(orgId: string, ruleId: string) {
    const rule = await this.prisma.transitionRule.findUnique({
      where: { id: ruleId },
      include: { pipeline: true },
    });
    if (!rule || rule.pipeline.organizationId !== orgId) {
      throw new NotFoundException('Transition rule not found');
    }
    return this.prisma.transitionRule.delete({ where: { id: ruleId } });
  }
}
