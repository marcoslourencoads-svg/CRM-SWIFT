import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

interface ImportError {
  row: number;
  message: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: ImportError[];
}

// Common column name variations mapped to canonical field names
const COLUMN_MAP: Record<string, string> = {
  title: 'title',
  titulo: 'title',
  lead: 'title',
  deal: 'title',
  name: 'name',
  nome: 'name',
  contact: 'name',
  contato: 'name',
  contact_name: 'name',
  contactname: 'name',
  email: 'email',
  'e-mail': 'email',
  contact_email: 'email',
  phone: 'phone',
  telefone: 'phone',
  tel: 'phone',
  celular: 'phone',
  contact_phone: 'phone',
  company: 'company',
  empresa: 'company',
  company_name: 'company',
  companyname: 'company',
  value: 'value',
  valor: 'value',
  estimated_value: 'value',
  estimatedvalue: 'value',
};

@Injectable()
export class ImportExportService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Import ─────────────────────────────────────────────────

  async importCsv(
    orgId: string,
    userId: string,
    pipelineId: string,
    fileBuffer: Buffer,
  ): Promise<ImportResult> {
    // Validate pipeline exists and belongs to org
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, organizationId: orgId, deletedAt: null },
    });
    if (!pipeline) {
      throw new BadRequestException('Pipeline not found');
    }

    // Get default status
    const defaultStatus = await this.prisma.pipelineStatus.findFirst({
      where: { pipelineId, isDefault: true },
    });
    if (!defaultStatus) {
      throw new BadRequestException('Pipeline has no default status');
    }

    // Parse CSV
    let records: Record<string, string>[];
    try {
      records = parse(fileBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relaxColumnCount: true,
      });
    } catch {
      throw new BadRequestException(
        'Failed to parse CSV file. Please check the format.',
      );
    }

    if (records.length === 0) {
      throw new BadRequestException('CSV file is empty');
    }

    // Auto-detect columns
    const headers = Object.keys(records[0]);
    const fieldMapping: Record<string, string> = {};

    for (const header of headers) {
      const normalized = header.toLowerCase().trim().replace(/[\s_-]+/g, '_');
      const mapped = COLUMN_MAP[normalized] || COLUMN_MAP[normalized.replace(/_/g, '')];
      if (mapped) {
        fieldMapping[header] = mapped;
      }
    }

    // Get max position in default status
    const maxPos = await this.prisma.lead.aggregate({
      where: { statusId: defaultStatus.id, deletedAt: null },
      _max: { position: true },
    });
    let nextPosition = (maxPos._max.position ?? -1) + 1;

    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // +2 because row 1 is header, data starts at 2

      try {
        const fields = this.extractFields(row, fieldMapping);

        // Must have at least a title or name
        if (!fields.title && !fields.name) {
          result.errors.push({
            row: rowNum,
            message: 'Missing title or name',
          });
          result.skipped++;
          continue;
        }

        const title = fields.title || fields.name!;

        // Find or create company
        let companyId: string | undefined;
        if (fields.company) {
          const company = await this.prisma.company.findFirst({
            where: { organizationId: orgId, name: fields.company },
          });
          if (company) {
            companyId = company.id;
          } else {
            const created = await this.prisma.company.create({
              data: { organizationId: orgId, name: fields.company },
            });
            companyId = created.id;
          }
        }

        // Find or create contact (dedup by email)
        let contactId: string | undefined;
        if (fields.email || fields.name || fields.phone) {
          let contact = fields.email
            ? await this.prisma.contact.findFirst({
                where: { organizationId: orgId, email: fields.email },
              })
            : null;

          if (!contact) {
            contact = await this.prisma.contact.create({
              data: {
                organizationId: orgId,
                name: fields.name || fields.email || 'Sem nome',
                email: fields.email || undefined,
                phone: fields.phone || undefined,
                companyId,
              },
            });
          }
          contactId = contact.id;
        }

        // Parse value
        const estimatedValue = fields.value
          ? Math.round(
              parseFloat(
                fields.value.replace(/[^\d.,]/g, '').replace(',', '.'),
              ) || 0,
            )
          : 0;

        // Create lead
        await this.prisma.lead.create({
          data: {
            organizationId: orgId,
            pipelineId,
            statusId: defaultStatus.id,
            title,
            estimatedValue,
            contactId,
            companyId,
            position: nextPosition++,
          },
        });

        result.imported++;
      } catch (err: any) {
        result.errors.push({
          row: rowNum,
          message: err.message || 'Unknown error',
        });
        result.skipped++;
      }
    }

    return result;
  }

  private extractFields(
    row: Record<string, string>,
    fieldMapping: Record<string, string>,
  ): Record<string, string | undefined> {
    const fields: Record<string, string | undefined> = {};

    for (const [header, canonical] of Object.entries(fieldMapping)) {
      const val = row[header]?.trim();
      if (val) {
        // First match wins (don't overwrite if already set)
        if (!fields[canonical]) {
          fields[canonical] = val;
        }
      }
    }

    return fields;
  }

  // ─── Export ─────────────────────────────────────────────────

  async exportCsv(
    orgId: string,
    filters: { pipelineId?: string; statusId?: string },
  ): Promise<string> {
    const where: any = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (filters.pipelineId) where.pipelineId = filters.pipelineId;
    if (filters.statusId) where.statusId = filters.statusId;

    const leads = await this.prisma.lead.findMany({
      where,
      include: {
        contact: { select: { name: true, email: true, phone: true } },
        company: { select: { name: true } },
        status: { select: { name: true } },
        assignee: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = leads.map((lead) => ({
      title: lead.title,
      'contact.name': lead.contact?.name || '',
      'contact.email': lead.contact?.email || '',
      'contact.phone': lead.contact?.phone || '',
      'company.name': lead.company?.name || '',
      estimatedValue: lead.estimatedValue,
      'status.name': lead.status?.name || '',
      'assignee.name': lead.assignee?.name || '',
      priority: lead.priority,
      temperature: lead.temperature,
      createdAt: lead.createdAt.toISOString(),
    }));

    return stringify(rows, {
      header: true,
      columns: [
        { key: 'title', header: 'Title' },
        { key: 'contact.name', header: 'Contact Name' },
        { key: 'contact.email', header: 'Contact Email' },
        { key: 'contact.phone', header: 'Contact Phone' },
        { key: 'company.name', header: 'Company' },
        { key: 'estimatedValue', header: 'Estimated Value' },
        { key: 'status.name', header: 'Status' },
        { key: 'assignee.name', header: 'Assignee' },
        { key: 'priority', header: 'Priority' },
        { key: 'temperature', header: 'Temperature' },
        { key: 'createdAt', header: 'Created At' },
      ],
    });
  }
}
