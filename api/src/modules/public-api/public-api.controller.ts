import {
  Controller,
  Post,
  Body,
  Req,
  SetMetadata,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LeadTrackingService } from '../lead-tracking/lead-tracking.service';
import { CreatePublicLeadDto } from './dto/create-public-lead.dto';
import { ApiKeyGuard, USE_API_KEY } from '../../common/guards/api-key.guard';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { TagsService } from '../tags/tags.service';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';

// Custom decorator to mark routes as API-key authenticated (bypasses JWT)
export const UseApiKey = () => SetMetadata(USE_API_KEY, true);

@Controller('public/v1')
@SetMetadata(IS_PUBLIC_KEY, true) // bypass JWT guard
@UseApiKey()
@UseGuards(ApiKeyGuard)
export class PublicApiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackingService: LeadTrackingService,
    private readonly tagsService: TagsService,
    private readonly customFieldsService: CustomFieldsService,
  ) {}

  @Post('leads')
  @HttpCode(HttpStatus.CREATED)
  async createLead(@Body() dto: CreatePublicLeadDto, @Req() req: any) {
    const orgId = (req as any).user.orgId;

    // Validate pipeline exists and belongs to org
    const defaultStatus = await this.prisma.pipelineStatus.findFirst({
      where: { pipelineId: dto.pipelineId, isDefault: true },
    });
    if (!defaultStatus) {
      throw new BadRequestException('Pipeline not found or has no default status');
    }

    // Get max position
    const maxPos = await this.prisma.lead.aggregate({
      where: { statusId: defaultStatus.id, deletedAt: null },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;

    // Transaction: create contact + company + lead + tracking
    const result = await this.prisma.$transaction(async (tx) => {
      let companyId: string | undefined;
      let contactId: string | undefined;

      // Create or find company
      if (dto.company) {
        const existing = await tx.company.findFirst({
          where: { organizationId: orgId, name: dto.company },
        });
        if (existing) {
          companyId = existing.id;
        } else {
          const created = await tx.company.create({
            data: { organizationId: orgId, name: dto.company },
          });
          companyId = created.id;
        }
      }

      // Create or find contact
      if (dto.email || dto.name) {
        const existingContact = dto.email
          ? await tx.contact.findFirst({
              where: { organizationId: orgId, email: dto.email },
            })
          : null;

        if (existingContact) {
          contactId = existingContact.id;
        } else {
          const created = await tx.contact.create({
            data: {
              organizationId: orgId,
              name: dto.name,
              email: dto.email,
              phone: dto.phone,
              companyId,
            },
          });
          contactId = created.id;
        }
      }

      // Create lead
      const lead = await tx.lead.create({
        data: {
          organizationId: orgId,
          pipelineId: dto.pipelineId,
          statusId: defaultStatus.id,
          title: dto.name,
          contactId,
          companyId,
          sourceId: dto.sourceId,
          position,
        },
        include: {
          status: true,
          contact: true,
          company: true,
        },
      });

      // Create tracking if any UTM/tracking data present
      const hasTracking =
        dto.utm_source ||
        dto.utm_medium ||
        dto.utm_campaign ||
        dto.utm_term ||
        dto.utm_content ||
        dto.referrer_url ||
        dto.landing_page ||
        dto.gclid ||
        dto.fbclid;

      let tracking = null;
      if (hasTracking) {
        tracking = await tx.leadTracking.create({
          data: {
            leadId: lead.id,
            utmSource: dto.utm_source,
            utmMedium: dto.utm_medium,
            utmCampaign: dto.utm_campaign,
            utmTerm: dto.utm_term,
            utmContent: dto.utm_content,
            referrerUrl: dto.referrer_url,
            landingPage: dto.landing_page,
            gclid: dto.gclid,
            fbclid: dto.fbclid,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          },
        });
      }

      let note = null;
      if (dto.notes && dto.notes.trim().length > 0) {
        note = await tx.note.create({
          data: {
            leadId: lead.id,
            userId: (req as any).user.sub,
            content: dto.notes.trim(),
          },
        });
      }

      return { lead, tracking, note };
    });

    const tagsAttached: string[] = [];
    if (dto.tagNames?.length) {
      const unique = Array.from(
        new Set(dto.tagNames.map((n) => n.trim()).filter((n) => n.length > 0)),
      );
      for (const name of unique) {
        try {
          const tag = await this.tagsService.upsertByName(orgId, name);
          await this.tagsService.addTagToLead(orgId, result.lead.id, tag.id);
          tagsAttached.push(tag.name);
        } catch (err) {
          // Don't fail the whole request if a tag couldn't be created.
          console.warn(`[public-api] failed to attach tag "${name}":`, err);
        }
      }
    }

    let customFieldsApplied = 0;
    if (dto.customFields && Object.keys(dto.customFields).length > 0) {
      const definitions = await this.prisma.customFieldDefinition.findMany({
        where: { pipelineId: dto.pipelineId },
      });
      const bySlug = new Map(definitions.map((d) => [d.slug, d]));
      const items = Object.entries(dto.customFields)
        .map(([key, value]) => {
          const def = bySlug.get(key);
          if (!def) return null;
          return { fieldDefinitionId: def.id, value };
        })
        .filter((x): x is { fieldDefinitionId: string; value: any } => x !== null);

      if (items.length > 0) {
        try {
          await this.customFieldsService.setValues(result.lead.id, items);
          customFieldsApplied = items.length;
        } catch (err) {
          console.warn('[public-api] failed to set custom fields:', err);
        }
      }
    }

    return { ...result, tagsAttached, customFieldsApplied };
  }
}
