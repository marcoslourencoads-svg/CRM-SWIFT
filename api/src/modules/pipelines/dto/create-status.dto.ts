import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';

export class CreateStatusDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  color?: string;

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
