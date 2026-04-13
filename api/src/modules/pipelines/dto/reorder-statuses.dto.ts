import { IsArray, IsString } from 'class-validator';

export class ReorderStatusesDto {
  @IsArray()
  @IsString({ each: true })
  statusIds: string[];
}
