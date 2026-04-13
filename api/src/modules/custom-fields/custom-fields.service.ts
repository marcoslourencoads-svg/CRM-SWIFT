import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFieldDefinitionDto } from './dto/create-field-definition.dto';
import { UpdateFieldDefinitionDto } from './dto/update-field-definition.dto';
import { FieldValueItemDto } from './dto/set-field-values.dto';
import { CustomFieldType } from '@prisma/client';

@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async listDefinitions(pipelineId: string) {
    return this.prisma.customFieldDefinition.findMany({
      where: { pipelineId },
      orderBy: { position: 'asc' },
    });
  }

  async createDefinition(pipelineId: string, dto: CreateFieldDefinitionDto) {
    if (
      (dto.type === CustomFieldType.SELECT ||
        dto.type === CustomFieldType.MULTI_SELECT) &&
      (!dto.options || !Array.isArray(dto.options) || dto.options.length === 0)
    ) {
      throw new BadRequestException(
        'options array is required for SELECT/MULTI_SELECT fields',
      );
    }

    const slug = this.generateSlug(dto.name);

    return this.prisma.customFieldDefinition.create({
      data: {
        pipelineId,
        name: dto.name,
        slug,
        type: dto.type,
        options: dto.options ?? undefined,
        defaultValue: dto.defaultValue,
        isRequired: dto.isRequired ?? false,
        isVisibleOnCard: dto.isVisibleOnCard ?? false,
        isFilterable: dto.isFilterable ?? true,
        position: dto.position ?? 0,
        validationRules: dto.validationRules ?? undefined,
      },
    });
  }

  async updateDefinition(id: string, dto: UpdateFieldDefinitionDto) {
    const existing = await this.prisma.customFieldDefinition.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Field definition not found');

    const type = dto.type ?? existing.type;
    if (
      (type === CustomFieldType.SELECT ||
        type === CustomFieldType.MULTI_SELECT) &&
      dto.options !== undefined &&
      (!Array.isArray(dto.options) || dto.options.length === 0)
    ) {
      throw new BadRequestException(
        'options array is required for SELECT/MULTI_SELECT fields',
      );
    }

    const data: any = { ...dto };
    if (dto.name) {
      data.slug = this.generateSlug(dto.name);
    }

    return this.prisma.customFieldDefinition.update({
      where: { id },
      data,
    });
  }

  async deleteDefinition(id: string) {
    const existing = await this.prisma.customFieldDefinition.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Field definition not found');

    await this.prisma.$transaction([
      this.prisma.customFieldValue.deleteMany({
        where: { fieldDefinitionId: id },
      }),
      this.prisma.customFieldDefinition.delete({ where: { id } }),
    ]);

    return { deleted: true };
  }

  async setValues(leadId: string, items: FieldValueItemDto[]) {
    const fieldIds = items.map((i) => i.fieldDefinitionId);
    const definitions = await this.prisma.customFieldDefinition.findMany({
      where: { id: { in: fieldIds } },
    });

    const defMap = new Map(definitions.map((d) => [d.id, d]));

    const upserts = items.map((item) => {
      const def = defMap.get(item.fieldDefinitionId);
      if (!def) {
        throw new BadRequestException(
          `Field definition ${item.fieldDefinitionId} not found`,
        );
      }

      const columns = this.resolveValueColumns(def.type, item.value);

      return this.prisma.customFieldValue.upsert({
        where: {
          leadId_fieldDefinitionId: {
            leadId,
            fieldDefinitionId: item.fieldDefinitionId,
          },
        },
        create: {
          leadId,
          fieldDefinitionId: item.fieldDefinitionId,
          ...columns,
        },
        update: columns,
      });
    });

    return this.prisma.$transaction(upserts);
  }

  async getValues(leadId: string) {
    return this.prisma.customFieldValue.findMany({
      where: { leadId },
      include: { fieldDefinition: true },
    });
  }

  private resolveValueColumns(
    type: CustomFieldType,
    value: any,
  ): {
    textValue?: string | null;
    numberValue?: number | null;
    dateValue?: Date | null;
    booleanValue?: boolean | null;
    jsonValue?: any;
  } {
    // Reset all columns
    const base = {
      textValue: null,
      numberValue: null,
      dateValue: null,
      booleanValue: null,
      jsonValue: null,
    };

    if (value === null || value === undefined) {
      return base;
    }

    switch (type) {
      case CustomFieldType.TEXT:
      case CustomFieldType.TEXTAREA:
      case CustomFieldType.URL:
      case CustomFieldType.PHONE:
      case CustomFieldType.EMAIL:
      case CustomFieldType.SELECT:
        return { ...base, textValue: String(value) };

      case CustomFieldType.NUMBER:
      case CustomFieldType.CURRENCY:
      case CustomFieldType.RATING:
      case CustomFieldType.PERCENTAGE:
        return { ...base, numberValue: Number(value) };

      case CustomFieldType.DATE:
      case CustomFieldType.DATETIME:
        return { ...base, dateValue: new Date(value) };

      case CustomFieldType.CHECKBOX:
        return { ...base, booleanValue: Boolean(value) };

      case CustomFieldType.MULTI_SELECT:
        return { ...base, jsonValue: value };

      default:
        return { ...base, textValue: String(value) };
    }
  }
}
