import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsBoolean,
  IsOptional,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ConditionOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  CONTAINS = 'CONTAINS',
  IS_SET = 'IS_SET',
  IS_NOT_SET = 'IS_NOT_SET',
}

export class RuleConditionDto {
  @IsString()
  @IsNotEmpty()
  field: string;

  @IsEnum(ConditionOperator)
  operator: ConditionOperator;

  @IsOptional()
  value?: any;
}

export class CreateScoringRuleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @ValidateNested()
  @Type(() => RuleConditionDto)
  condition: RuleConditionDto;

  @IsInt()
  points: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
