import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { LeadSourceType } from '@prisma/client';

export class CreateLeadSourceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

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
}
