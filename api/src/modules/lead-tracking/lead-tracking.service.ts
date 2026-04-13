import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateTrackingData {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrerUrl?: string;
  landingPage?: string;
  gclid?: string;
  fbclid?: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class LeadTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(leadId: string, data: CreateTrackingData) {
    return this.prisma.leadTracking.create({
      data: {
        leadId,
        ...data,
      },
    });
  }

  async findByLead(leadId: string) {
    return this.prisma.leadTracking.findUnique({
      where: { leadId },
    });
  }
}
