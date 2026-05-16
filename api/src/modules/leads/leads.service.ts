import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
import { PipelinePermissionsService } from '../pipelines/pipeline-permissions.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { MoveLeadDto } from './dto/move-lead.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { BulkMoveDto, BulkAssignDto, BulkDeleteDto } from './dto/bulk-action.dto';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activities: ActivitiesService,
    private readonly pipelinePermissions: PipelinePermissionsService,
    private readonly eventBus: EventEmitter2,
  ) {}

  async create(orgId: string, userId: string, dto: CreateLeadDto) {
    let targetStatusId: string;

    if (dto.statusId) {
      // Validate that the status belongs to this pipeline
      const status = await this.prisma.pipelineStatus.findFirst({
        where: { id: dto.statusId, pipelineId: dto.pipelineId },
      });
      if (!status) {
        throw new BadRequestException('Status not found in this pipeline');
      }
      targetStatusId = status.id;
    } else {
      // Get default status for the pipeline
      const defaultStatus = await this.prisma.pipelineStatus.findFirst({
        where: { pipelineId: dto.pipelineId, isDefault: true },
      });
      if (!defaultStatus) {
        throw new BadRequestException('Pipeline has no default status');
      }
      targetStatusId = defaultStatus.id;
    }

    // Get max position in target status
    const maxPos = await this.prisma.lead.aggregate({
      where: { statusId: targetStatusId, deletedAt: null },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;

    // Create or find contact if contact info provided
    let contactId: string | undefined;
    let companyId: string | undefined;

    if (dto.companyName) {
      const company = await this.prisma.company.upsert({
        where: {
          id: 'new', // force create path via findFirst below
        },
        update: {},
        create: {
          organizationId: orgId,
          name: dto.companyName,
        },
      }).catch(async () => {
        // upsert workaround: find or create
        const existing = await this.prisma.company.findFirst({
          where: { organizationId: orgId, name: dto.companyName },
        });
        if (existing) return existing;
        return this.prisma.company.create({
          data: { organizationId: orgId, name: dto.companyName! },
        });
      });
      companyId = company.id;
    }

    if (dto.contactName || dto.contactEmail) {
      // Try to find existing contact by email
      let contact = dto.contactEmail
        ? await this.prisma.contact.findFirst({
            where: { organizationId: orgId, email: dto.contactEmail },
          })
        : null;

      if (!contact) {
        contact = await this.prisma.contact.create({
          data: {
            organizationId: orgId,
            name: dto.contactName || dto.contactEmail || 'Sem nome',
            email: dto.contactEmail,
            phone: dto.contactPhone,
            companyId,
          },
        });
      }
      contactId = contact.id;
    }

    const lead = await this.prisma.lead.create({
      data: {
        organizationId: orgId,
        pipelineId: dto.pipelineId,
        statusId: targetStatusId,
        title: dto.title,
        estimatedValue: dto.estimatedValue || 0,
        priority: dto.priority || 'MEDIUM',
        temperature: dto.temperature || 'WARM',
        assigneeId: dto.assigneeId,
        contactId,
        companyId,
        position,
      },
      include: {
        status: true,
        assignee: { select: { id: true, name: true, email: true } },
        contact: true,
        company: true,
      },
    });

    await this.activities.logActivity(lead.id, userId, 'CREATED', {
      title: lead.title,
    });

    this.eventBus.emit('lead.created', {
      leadId: lead.id,
      orgId,
      userId,
    });

    return lead;
  }

  async findByPipeline(
    orgId: string,
    pipelineId: string,
    filters?: {
      statusId?: string;
      assigneeId?: string;
      search?: string;
      tagIds?: string[];
      temperature?: string;
      createdAfter?: string | Date;
      createdBefore?: string | Date;
      limit?: number;
      cursor?: string;
    },
    requesterUser?: { userId: string; role: string },
  ) {
    const where: any = {
      organizationId: orgId,
      pipelineId,
      deletedAt: null,
    };

    // Permission per pipeline: se requester não pode ver todos os leads,
    // limita aos atribuídos a ele.
    if (requesterUser) {
      const perms = await this.pipelinePermissions.getEffectivePermissions(
        requesterUser.userId,
        pipelineId,
        requesterUser.role,
      );
      if (!perms.canSeeAllLeads) {
        where.assigneeId = requesterUser.userId;
      }
    }

    if (filters?.statusId) where.statusId = filters.statusId;
    if (filters?.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters?.temperature) where.temperature = filters.temperature;

    if (filters?.tagIds && filters.tagIds.length > 0) {
      // Lead must have ALL tags listed.
      where.AND = filters.tagIds.map((tagId) => ({
        tags: { some: { tagId } },
      }));
    }

    if (filters?.createdAfter || filters?.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) where.createdAt.gte = new Date(filters.createdAfter);
      if (filters.createdBefore) where.createdAt.lte = new Date(filters.createdBefore);
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { contact: { name: { contains: filters.search, mode: 'insensitive' } } },
        { contact: { email: { contains: filters.search, mode: 'insensitive' } } },
        { company: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const take = filters?.limit || 500;

    return this.prisma.lead.findMany({
      where,
      include: {
        status: true,
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } },
        company: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
        customFieldValues: {
          where: { fieldDefinition: { isVisibleOnCard: true } },
          include: { fieldDefinition: true },
        },
        tasks: {
          where: { completedAt: null },
          select: { id: true, dueDate: true },
        },
        score: { select: { score: true } },
      },
      orderBy: [{ statusId: 'asc' }, { position: 'asc' }],
      take,
      ...(filters?.cursor ? { skip: 1, cursor: { id: filters.cursor } } : {}),
    });
  }

  /**
   * Lista flat de todos os leads da org, atravessando todos os pipelines.
   * Usado pela tela /leads (visão "Todos os leads").
   */
  async findAllForOrg(
    orgId: string,
    filters?: {
      search?: string;
      pipelineId?: string;
      statusId?: string;
      assigneeId?: string;
      tagIds?: string[];
      temperature?: string;
      isWon?: boolean;
      isLost?: boolean;
      createdAfter?: string | Date;
      createdBefore?: string | Date;
      limit?: number;
      cursor?: string;
    },
  ) {
    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (filters?.pipelineId) where.pipelineId = filters.pipelineId;
    if (filters?.statusId) where.statusId = filters.statusId;
    if (filters?.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters?.temperature) where.temperature = filters.temperature;

    if (filters?.isWon === true) where.status = { isWon: true };
    else if (filters?.isLost === true) where.status = { isFinal: true, isWon: false };

    if (filters?.tagIds && filters.tagIds.length > 0) {
      where.AND = filters.tagIds.map((tagId) => ({
        tags: { some: { tagId } },
      }));
    }

    if (filters?.createdAfter || filters?.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) where.createdAt.gte = new Date(filters.createdAfter);
      if (filters.createdBefore) where.createdAt.lte = new Date(filters.createdBefore);
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { contact: { name: { contains: filters.search, mode: 'insensitive' } } },
        { contact: { email: { contains: filters.search, mode: 'insensitive' } } },
        { contact: { phone: { contains: filters.search } } },
        { company: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const take = filters?.limit || 200;

    return this.prisma.lead.findMany({
      where,
      include: {
        status: { select: { id: true, name: true, color: true, isWon: true, isFinal: true } },
        pipeline: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } },
        company: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
        score: { select: { score: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      ...(filters?.cursor ? { skip: 1, cursor: { id: filters.cursor } } : {}),
    });
  }

  async findOne(orgId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        status: true,
        pipeline: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        contact: true,
        company: true,
        tags: { include: { tag: true } },
        notes: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        customFieldValues: {
          include: { fieldDefinition: true },
        },
        score: true,
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async update(orgId: string, userId: string, id: string, dto: UpdateLeadDto) {
    const lead = await this.findOne(orgId, id);

    // Optimistic locking
    if (dto.version !== lead.version) {
      throw new ConflictException(
        'This lead was modified by another user. Please refresh and try again.',
      );
    }

    const { version, expectedCloseDate, ...data } = dto;

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        ...data,
        ...(expectedCloseDate ? { expectedCloseDate: new Date(expectedCloseDate) } : {}),
        lastActivityAt: new Date(),
        version: { increment: 1 },
      },
      include: {
        status: true,
        assignee: { select: { id: true, name: true, email: true } },
        contact: true,
        company: true,
      },
    });

    const trackedFields = ['title', 'priority', 'temperature', 'estimatedValue', 'probability', 'lostReason'];
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of trackedFields) {
      const dtoValue = (dto as any)[field];
      if (dtoValue !== undefined && (lead as any)[field] !== dtoValue) {
        changes[field] = { from: (lead as any)[field], to: dtoValue };
      }
    }
    if (Object.keys(changes).length > 0) {
      await this.activities.logActivity(id, userId, 'FIELD_UPDATED', {
        changes: JSON.parse(JSON.stringify(changes)),
      });
    }

    return updated;
  }

  async move(orgId: string, userId: string, id: string, dto: MoveLeadDto) {
    const lead = await this.findOne(orgId, id);

    // Verify status belongs to same pipeline
    const newStatus = await this.prisma.pipelineStatus.findFirst({
      where: { id: dto.statusId, pipelineId: lead.pipelineId },
    });
    if (!newStatus) {
      throw new BadRequestException('Status does not belong to this pipeline');
    }

    // Calculate position
    let position = dto.position;
    if (position === undefined) {
      const maxPos = await this.prisma.lead.aggregate({
        where: { statusId: dto.statusId, deletedAt: null },
        _max: { position: true },
      });
      position = (maxPos._max.position ?? -1) + 1;
    }

    const now = new Date();

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        statusId: dto.statusId,
        position,
        lastActivityAt: now,
        lastStatusChangedAt: now,
        version: { increment: 1 },
        // Auto-fill wonAt/lostAt
        ...(newStatus.isFinal && newStatus.isWon ? { wonAt: now } : {}),
        ...(newStatus.isFinal && !newStatus.isWon ? { lostAt: now } : {}),
      },
      include: {
        status: true,
        assignee: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
      },
    });

    if (lead.statusId !== dto.statusId) {
      const fromName = (lead as any).status?.name ?? lead.statusId;
      const toName = newStatus.name;
      let activityType: 'STATUS_CHANGED' | 'LEAD_WON' | 'LEAD_LOST' = 'STATUS_CHANGED';
      if (newStatus.isFinal && newStatus.isWon) activityType = 'LEAD_WON';
      else if (newStatus.isFinal && !newStatus.isWon) activityType = 'LEAD_LOST';
      await this.activities.logActivity(id, userId, activityType, {
        from: fromName,
        to: toName,
      });

      this.eventBus.emit('lead.status_changed', {
        leadId: id,
        fromStatusId: lead.statusId,
        toStatusId: dto.statusId,
        orgId,
        userId,
      });
    }

    return updated;
  }

  async assign(orgId: string, userId: string, id: string, dto: AssignLeadDto) {
    const previous = await this.findOne(orgId, id);

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        assigneeId: dto.assigneeId,
        lastActivityAt: new Date(),
        version: { increment: 1 },
      },
      include: {
        status: true,
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    if (previous.assigneeId !== dto.assigneeId) {
      await this.activities.logActivity(id, userId, 'ASSIGNED', {
        assignee: updated.assignee?.name ?? null,
      });

      if (dto.assigneeId) {
        this.eventBus.emit('lead.assigned', {
          leadId: id,
          assigneeId: dto.assigneeId,
          orgId,
          userId,
        });
      }
    }

    return updated;
  }

  async remove(orgId: string, userId: string, id: string) {
    await this.findOne(orgId, id);
    return this.prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Bulk Operations ────────────────────────────────────

  async bulkMove(orgId: string, dto: BulkMoveDto) {
    return this.prisma.lead.updateMany({
      where: { id: { in: dto.leadIds }, organizationId: orgId, deletedAt: null },
      data: {
        statusId: dto.statusId,
        lastActivityAt: new Date(),
        lastStatusChangedAt: new Date(),
      },
    });
  }

  async bulkAssign(orgId: string, dto: BulkAssignDto) {
    return this.prisma.lead.updateMany({
      where: { id: { in: dto.leadIds }, organizationId: orgId, deletedAt: null },
      data: {
        assigneeId: dto.assigneeId,
        lastActivityAt: new Date(),
      },
    });
  }

  async bulkDelete(orgId: string, dto: BulkDeleteDto) {
    return this.prisma.lead.updateMany({
      where: { id: { in: dto.leadIds }, organizationId: orgId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}
