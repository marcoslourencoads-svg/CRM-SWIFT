import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';

export class MoveLeadDto {
  @IsString()
  @IsNotEmpty()
  statusId: string;

  @IsInt()
  @IsOptional()
  position?: number;
}
