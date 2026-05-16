import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { LeadPriority, LeadTaskType } from '@prisma/client';

export class CreateLeadTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

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
