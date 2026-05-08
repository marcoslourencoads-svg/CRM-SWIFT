import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { MoveLeadDto } from './dto/move-lead.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { BulkMoveDto, BulkAssignDto, BulkDeleteDto } from './dto/bulk-action.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.lead.create({
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
  }

  async findByPipeline(
    orgId: string,
    pipelineId: string,
    filters?: {
      statusId?: string;
      assigneeId?: string;
      search?: string;
      limit?: number;
      cursor?: string;
    },
  ) {
    const where: any = {
      organizationId: orgId,
      pipelineId,
      deletedAt: null,
    };

    if (filters?.statusId) where.statusId = filters.statusId;
    if (filters?.assigneeId) where.assigneeId = filters.assigneeId;
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
      },
      orderBy: [{ statusId: 'asc' }, { position: 'asc' }],
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
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async update(orgId: string, id: string, dto: UpdateLeadDto) {
    const lead = await this.findOne(orgId, id);

    // Optimistic locking
    if (dto.version !== lead.version) {
      throw new ConflictException(
        'This lead was modified by another user. Please refresh and try again.',
      );
    }

    const { version, expectedCloseDate, ...data } = dto;

    return this.prisma.lead.update({
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
  }

  async move(orgId: string, id: string, dto: MoveLeadDto) {
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

    return this.prisma.lead.update({
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
  }

  async assign(orgId: string, id: string, dto: AssignLeadDto) {
    await this.findOne(orgId, id);

    return this.prisma.lead.update({
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
  }

  async remove(orgId: string, id: string) {
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
