import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { LeadPriority } from '@prisma/client';

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
  @IsNotEmpty()
  assigneeId: string;

  @IsEnum(LeadPriority)
  @IsOptional()
  priority?: LeadPriority;
}
