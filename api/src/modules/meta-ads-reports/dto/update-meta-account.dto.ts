import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { MetaReportChannel } from '@prisma/client';

export class UpdateMetaAccountDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  clientName?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(act_)?\d+$/, {
    message: 'adAccountId deve ser numérico (com ou sem prefixo "act_")',
  })
  adAccountId?: string;

  @IsString()
  @IsOptional()
  accessToken?: string;

  @IsEnum(MetaReportChannel)
  @IsOptional()
  reportChannel?: MetaReportChannel;

  @IsString()
  @IsOptional()
  reportTarget?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(\S+\s+){4}\S+$/, {
    message: 'scheduleCron deve ter 5 campos (ex: "0 8 * * *")',
  })
  scheduleCron?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
