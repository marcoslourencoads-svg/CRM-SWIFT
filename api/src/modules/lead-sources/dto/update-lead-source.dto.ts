import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { LeadSourceType } from '@prisma/client';

export class UpdateLeadSourceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(LeadSourceType)
  @IsOptional()
  type?: LeadSourceType;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
