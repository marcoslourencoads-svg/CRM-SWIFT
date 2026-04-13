import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TriggerDto {
  @IsString()
  @IsNotEmpty()
  type: string; // LEAD_CREATED | LEAD_MOVED | LEAD_ASSIGNED | FIELD_CHANGED | TAG_ADDED

  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}

export class ConditionDto {
  @IsString()
  @IsNotEmpty()
  field: string;

  @IsString()
  @IsNotEmpty()
  operator: string; // EQUALS | NOT_EQUALS | CONTAINS | GT | LT | IN | NOT_IN

  value: any;
}

export class ActionDto {
  @IsString()
  @IsNotEmpty()
  type: string; // MOVE_TO_STATUS | ASSIGN_TO | ADD_TAG | SET_FIELD | SEND_NOTIFICATION

  @IsObject()
  params: Record<string, any>;
}

export class CreateAutomationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  pipelineId?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => TriggerDto)
  trigger: TriggerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  @IsOptional()
  conditions?: ConditionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  actions: ActionDto[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
