import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Matches,
} from 'class-validator';

export class CreateInvestmentDto {
  @IsString()
  @IsOptional()
  sourceId?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be in YYYY-MM format',
  })
  month: string;

  @IsInt()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateInvestmentDto {
  @IsString()
  @IsOptional()
  sourceId?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be in YYYY-MM format',
  })
  month?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  description?: string;
}
