import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { LeadPriority, LeadTemperature } from '@prisma/client';

export class CreateLeadDto {
  @IsString()
  @IsOptional()
  pipelineId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  contactName?: string;

  @IsString()
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  companyName?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedValue?: number;

  @IsEnum(LeadPriority)
  @IsOptional()
  priority?: LeadPriority;

  @IsEnum(LeadTemperature)
  @IsOptional()
  temperature?: LeadTemperature;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  statusId?: string;
}
