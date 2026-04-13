import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { LeadPriority, LeadTemperature } from '@prisma/client';

export class UpdateLeadDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedValue?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  probability?: number;

  @IsEnum(LeadPriority)
  @IsOptional()
  priority?: LeadPriority;

  @IsEnum(LeadTemperature)
  @IsOptional()
  temperature?: LeadTemperature;

  @IsDateString()
  @IsOptional()
  expectedCloseDate?: string;

  @IsString()
  @IsOptional()
  lostReason?: string;

  @IsInt()
  version: number;
}
