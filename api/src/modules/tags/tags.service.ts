import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activities: ActivitiesService,
    private readonly eventBus: EventEmitter2,
  ) {}

  async findAll(orgId: string) {
    return this.prisma.tag.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    });
  }

  async upsertByName(orgId: string, name: string, color?: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new ConflictException('Tag name cannot be empty');

    const existing = await this.prisma.tag.findFirst({
      where: {
        organizationId: orgId,
        name: { equals: trimmed, mode: 'insensitive' },
      },
    });
    if (existing) return existing;

    const palette = ['#6B7280', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#14B8A6'];
    const fallback = palette[Math.abs(hashString(trimmed)) % palette.length];

    return this.prisma.tag.create({
      data: {
        organizationId: orgId,
        name: trimmed,
        color: color ?? fallback,
      },
    });
  }

  async create(orgId: string, dto: CreateTagDto) {
    const exists = await this.prisma.tag.findUnique({
      where: { organizationId_name: { organizationId: orgId, name: dto.name } },
    });
    if (exists) {
      throw new ConflictException('A tag with this name already exists');
    }

    return this.prisma.tag.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        color: dto.color,
      },
    });
  }

  async update(orgId: string, id: string, dto: UpdateTagDto) {
    const tag = await this.prisma.tag.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!tag) throw new NotFoundException('Tag not found');

    if (dto.name && dto.name !== tag.name) {
      const duplicate = await this.prisma.tag.findUnique({
        where: { organizationId_name: { organizationId: orgId, name: dto.name } },
      });
      if (duplicate) {
        throw new ConflictException('A tag with this name already exists');
      }
    }

    return this.prisma.tag.update({
      where: { id },
      data: dto,
    });
  }

  async remove(orgId: string, id: string) {
    const tag = await this.prisma.tag.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!tag) throw new NotFoundException('Tag not found');

    // Delete associated LeadTag records first, then the tag
    await this.prisma.leadTag.deleteMany({ where: { tagId: id } });
    return this.prisma.tag.delete({ where: { id } });
  }

  // ─── Lead ↔ Tag Association ──────────────────────────────

  async addTagToLead(orgId: string, leadId: string, tagId: string, userId?: string) {
    // Verify lead belongs to org
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    // Verify tag belongs to org
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, organizationId: orgId },
    });
    if (!tag) throw new NotFoundException('Tag not found');

    // Upsert to avoid duplicate errors
    const result = await this.prisma.leadTag.upsert({
      where: { leadId_tagId: { leadId, tagId } },
      update: {},
      create: { leadId, tagId },
      include: { tag: true },
    });

    await this.activities.logActivity(leadId, userId ?? null, 'TAG_ADDED', {
      tag: tag.name,
    });

    this.eventBus.emit('lead.tag_added', { leadId, tagId, orgId, userId });

    return result;
  }

  async removeTagFromLead(orgId: string, leadId: string, tagId: string, userId?: string) {
    // Verify lead belongs to org
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const existing = await this.prisma.leadTag.findUnique({
      where: { leadId_tagId: { leadId, tagId } },
      include: { tag: true },
    });
    if (!existing) throw new NotFoundException('Tag not associated with this lead');

    const result = await this.prisma.leadTag.delete({
      where: { leadId_tagId: { leadId, tagId } },
    });

    await this.activities.logActivity(leadId, userId ?? null, 'TAG_REMOVED', {
      tag: existing.tag.name,
    });

    return result;
  }
}
