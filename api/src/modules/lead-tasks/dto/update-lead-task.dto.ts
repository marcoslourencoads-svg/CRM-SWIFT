import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { LeadPriority, LeadTaskType } from '@prisma/client';

export class UpdateLeadTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsEnum(LeadPriority)
  @IsOptional()
  priority?: LeadPriority;

  @IsEnum(LeadTaskType)
  @IsOptional()
  type?: LeadTaskType;
}
