import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface UpsertTemplateDto {
  name: string;
  content: string;
}

@Injectable()
export class WhatsappTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(orgId: string) {
    return this.prisma.whatsappTemplate.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    });
  }

  create(orgId: string, dto: UpsertTemplateDto) {
    return this.prisma.whatsappTemplate.create({
      data: { organizationId: orgId, name: dto.name, content: dto.content },
    });
  }

  async update(orgId: string, id: string, dto: Partial<UpsertTemplateDto>) {
    const template = await this.prisma.whatsappTemplate.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!template) throw new NotFoundException('Template not found');
    return this.prisma.whatsappTemplate.update({ where: { id }, data: dto });
  }

  async remove(orgId: string, id: string) {
    const template = await this.prisma.whatsappTemplate.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!template) throw new NotFoundException('Template not found');
    return this.prisma.whatsappTemplate.delete({ where: { id } });
  }
}
