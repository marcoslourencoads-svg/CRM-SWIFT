import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  IsArray,
  Min,
} from 'class-validator';
import { CustomFieldType } from '@prisma/client';

export class UpdateFieldDefinitionDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(CustomFieldType)
  @IsOptional()
  type?: CustomFieldType;

  @IsArray()
  @IsOptional()
  options?: any[];

  @IsString()
  @IsOptional()
  defaultValue?: string;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  isVisibleOnCard?: boolean;

  @IsBoolean()
  @IsOptional()
  isFilterable?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  position?: number;

  @IsOptional()
  validationRules?: any;
}
