import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TriggerDto, ConditionDto, ActionDto } from './create-automation.dto';

export class UpdateAutomationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  pipelineId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => TriggerDto)
  @IsOptional()
  trigger?: TriggerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  @IsOptional()
  conditions?: ConditionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  @IsOptional()
  actions?: ActionDto[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
