import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface ContactDto {
  name: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  companyId?: string | null;
}

interface CompanyDto {
  name: string;
  domain?: string | null;
  industry?: string | null;
  website?: string | null;
}

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Contacts ----------

  listContacts(orgId: string, search?: string, companyId?: string) {
    return this.prisma.contact.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        ...(companyId ? { companyId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { leads: true } },
      },
      orderBy: { name: 'asc' },
      take: 500,
    });
  }

  async getContact(orgId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        company: true,
        leads: {
          select: {
            id: true,
            title: true,
            estimatedValue: true,
            pipeline: { select: { id: true, name: true } },
            status: { select: { name: true, color: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!contact) throw new NotFoundException('Contato não encontrado');
    return contact;
  }

  createContact(orgId: string, dto: ContactDto) {
    return this.prisma.contact.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        jobTitle: dto.jobTitle ?? null,
        companyId: dto.companyId ?? null,
      },
      include: { company: { select: { id: true, name: true } } },
    });
  }

  async updateContact(orgId: string, id: string, dto: Partial<ContactDto>) {
    const existing = await this.prisma.contact.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Contato não encontrado');

    return this.prisma.contact.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle } : {}),
        ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
      },
      include: { company: { select: { id: true, name: true } } },
    });
  }

  async removeContact(orgId: string, id: string) {
    const existing = await this.prisma.contact.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Contato não encontrado');
    return this.prisma.contact.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ---------- Companies ----------

  listCompanies(orgId: string, search?: string) {
    return this.prisma.company.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { domain: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        _count: { select: { contacts: true, leads: true } },
      },
      orderBy: { name: 'asc' },
      take: 500,
    });
  }

  async getCompany(orgId: string, id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        contacts: {
          where: { deletedAt: null },
          select: { id: true, name: true, email: true, phone: true, jobTitle: true },
          orderBy: { name: 'asc' },
        },
        leads: {
          select: {
            id: true,
            title: true,
            estimatedValue: true,
            pipeline: { select: { id: true, name: true } },
            status: { select: { name: true, color: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }

  createCompany(orgId: string, dto: CompanyDto) {
    return this.prisma.company.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        domain: dto.domain ?? null,
        industry: dto.industry ?? null,
        website: dto.website ?? null,
      },
    });
  }

  async updateCompany(orgId: string, id: string, dto: Partial<CompanyDto>) {
    const existing = await this.prisma.company.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Empresa não encontrada');

    return this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.domain !== undefined ? { domain: dto.domain } : {}),
        ...(dto.industry !== undefined ? { industry: dto.industry } : {}),
        ...(dto.website !== undefined ? { website: dto.website } : {}),
      },
    });
  }

  async removeCompany(orgId: string, id: string) {
    const existing = await this.prisma.company.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Empresa não encontrada');
    return this.prisma.company.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
