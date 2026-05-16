import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeadTaskDto } from './dto/create-lead-task.dto';
import { UpdateLeadTaskDto } from './dto/update-lead-task.dto';

@Injectable()
export class LeadTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventEmitter2,
  ) {}

  private readonly taskInclude = {
    assignee: { select: { id: true, name: true, avatarUrl: true } },
    creator: { select: { id: true, name: true } },
    lead: { select: { id: true, title: true } },
  };

  async findByLead(leadId: string) {
    return this.prisma.leadTask.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      include: this.taskInclude,
    });
  }

  async findMine(userId: string, status?: string) {
    const now = new Date();
    const where: any = { assigneeId: userId };

    if (status === 'pending') {
      where.completedAt = null;
    } else if (status === 'completed') {
      where.completedAt = { not: null };
    } else if (status === 'overdue') {
      where.completedAt = null;
      where.dueDate = { lt: now };
    }

    return this.prisma.leadTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: this.taskInclude,
    });
  }

  /**
   * Lista tasks da org com filtros opcionais.
   * Usado pelo calendário pra filtrar por responsável / pipeline / status.
   */
  async findForOrg(
    orgId: string,
    filters: {
      assigneeId?: string;
      pipelineId?: string;
      status?: 'pending' | 'completed' | 'overdue';
      type?: string;
      from?: Date;
      to?: Date;
    } = {},
  ) {
    const now = new Date();
    const where: any = {
      lead: { organizationId: orgId },
    };

    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters.pipelineId) where.lead = { ...where.lead, pipelineId: filters.pipelineId };
    if (filters.type) where.type = filters.type;

    if (filters.status === 'pending') where.completedAt = null;
    else if (filters.status === 'completed') where.completedAt = { not: null };
    else if (filters.status === 'overdue') {
      where.completedAt = null;
      where.dueDate = { lt: now };
    }

    if (filters.from || filters.to) {
      where.dueDate = {
        ...(where.dueDate ?? {}),
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }

    return this.prisma.leadTask.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: this.taskInclude,
    });
  }

  async create(leadId: string, userId: string, dto: CreateLeadTaskDto) {
    return this.prisma.leadTask.create({
      data: {
        leadId,
        createdBy: userId,
        assigneeId: dto.assigneeId ?? userId,
        title: dto.title,
        description: dto.description,
        type: dto.type ?? 'TASK',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        priority: dto.priority ?? 'MEDIUM',
      },
      include: this.taskInclude,
    });
  }

  async update(id: string, dto: UpdateLeadTaskDto) {
    const task = await this.prisma.leadTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.leadTask.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: new Date(dto.dueDate) } : {}),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
      },
      include: this.taskInclude,
    });
  }

  async complete(id: string) {
    const task = await this.prisma.leadTask.findUnique({
      where: { id },
      include: { lead: { select: { id: true, organizationId: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');

    const updated = await this.prisma.leadTask.update({
      where: { id },
      data: { completedAt: new Date() },
      include: this.taskInclude,
    });

    this.eventBus.emit('lead.task_completed', {
      leadId: task.leadId,
      taskId: id,
      orgId: task.lead.organizationId,
    });

    return updated;
  }
}
