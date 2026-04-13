import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateStatusDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsBoolean()
  @IsOptional()
  isFinal?: boolean;

  @IsBoolean()
  @IsOptional()
  isWon?: boolean;

  @IsBoolean()
  @IsOptional()
  isMql?: boolean;

  @IsBoolean()
  @IsOptional()
  isMeeting?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  staleAfterDays?: number;
}
