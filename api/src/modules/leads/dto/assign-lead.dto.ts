import { IsString, IsOptional } from 'class-validator';

export class AssignLeadDto {
  @IsString()
  @IsOptional()
  assigneeId: string | null;
}
