import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsInt,
  IsBoolean,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';

export class UpsertProspectListDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  niche?: string;

  // Intervalos em dias entre os toques. [2,4,7] = FUP 1 dois dias depois
  // da abordagem, FUP 2 quatro dias depois do FUP 1, FUP 3 sete depois.
  @IsArray()
  @ArrayMaxSize(12)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(365, { each: true })
  @IsOptional()
  cadenceDays?: number[];

  @IsBoolean()
  @IsOptional()
  archived?: boolean;
}

export class UpsertApproachDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsInt()
  @IsOptional()
  position?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
