import { IsArray, IsString, IsOptional } from 'class-validator';

export class BulkMoveDto {
  @IsArray()
  @IsString({ each: true })
  leadIds: string[];

  @IsString()
  statusId: string;
}

export class BulkAssignDto {
  @IsArray()
  @IsString({ each: true })
  leadIds: string[];

  @IsString()
  @IsOptional()
  assigneeId: string | null;
}

export class BulkDeleteDto {
  @IsArray()
  @IsString({ each: true })
  leadIds: string[];
}
