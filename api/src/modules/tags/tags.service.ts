import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string) {
    return this.prisma.tag.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
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

  async addTagToLead(orgId: string, leadId: string, tagId: string) {
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
    return this.prisma.leadTag.upsert({
      where: { leadId_tagId: { leadId, tagId } },
      update: {},
      create: { leadId, tagId },
      include: { tag: true },
    });
  }

  async removeTagFromLead(orgId: string, leadId: string, tagId: string) {
    // Verify lead belongs to org
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const existing = await this.prisma.leadTag.findUnique({
      where: { leadId_tagId: { leadId, tagId } },
    });
    if (!existing) throw new NotFoundException('Tag not associated with this lead');

    return this.prisma.leadTag.delete({
      where: { leadId_tagId: { leadId, tagId } },
    });
  }
}
