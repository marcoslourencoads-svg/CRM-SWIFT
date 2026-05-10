import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface UpsertReasonDto {
  name: string;
  position?: number;
  isActive?: boolean;
}

@Injectable()
export class LostReasonsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string) {
    return this.prisma.lostReason.findMany({
      where: { organizationId: orgId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }

  async create(orgId: string, dto: UpsertReasonDto) {
    const exists = await this.prisma.lostReason.findFirst({
      where: { organizationId: orgId, name: dto.name },
    });
    if (exists) throw new ConflictException('Reason with this name already exists');
    return this.prisma.lostReason.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        position: dto.position ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(orgId: string, id: string, dto: Partial<UpsertReasonDto>) {
    const reason = await this.prisma.lostReason.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!reason) throw new NotFoundException('Reason not found');
    return this.prisma.lostReason.update({ where: { id }, data: dto });
  }

  async remove(orgId: string, id: string) {
    const reason = await this.prisma.lostReason.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!reason) throw new NotFoundException('Reason not found');
    return this.prisma.lostReason.delete({ where: { id } });
  }
}
