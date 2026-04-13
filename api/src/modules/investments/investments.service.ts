import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateInvestmentDto,
  UpdateInvestmentDto,
} from './dto/create-investment.dto';

@Injectable()
export class InvestmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, month?: string) {
    return this.prisma.monthlyInvestment.findMany({
      where: {
        organizationId: orgId,
        ...(month ? { month } : {}),
      },
      orderBy: { month: 'desc' },
    });
  }

  async findOne(orgId: string, id: string) {
    const record = await this.prisma.monthlyInvestment.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!record) throw new NotFoundException('Investment not found');
    return record;
  }

  async create(orgId: string, dto: CreateInvestmentDto) {
    return this.prisma.monthlyInvestment.create({
      data: {
        organizationId: orgId,
        sourceId: dto.sourceId,
        month: dto.month,
        amount: dto.amount,
        description: dto.description,
      },
    });
  }

  async update(orgId: string, id: string, dto: UpdateInvestmentDto) {
    await this.findOne(orgId, id);
    return this.prisma.monthlyInvestment.update({
      where: { id },
      data: {
        ...(dto.sourceId !== undefined ? { sourceId: dto.sourceId } : {}),
        ...(dto.month !== undefined ? { month: dto.month } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
      },
    });
  }

  async remove(orgId: string, id: string) {
    await this.findOne(orgId, id);
    return this.prisma.monthlyInvestment.delete({ where: { id } });
  }
}
