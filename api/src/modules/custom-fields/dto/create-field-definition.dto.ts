import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  IsArray,
  Min,
  ValidateIf,
} from 'class-validator';
import { CustomFieldType } from '@prisma/client';

export class CreateFieldDefinitionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(CustomFieldType)
  type: CustomFieldType;

  @ValidateIf((o) => o.type === 'SELECT' || o.type === 'MULTI_SELECT')
  @IsArray()
  @IsNotEmpty({ message: 'options is required for SELECT/MULTI_SELECT fields' })
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
