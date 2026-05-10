import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { MetaReportChannel } from '@prisma/client';

export class CreateMetaAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  clientName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(act_)?\d+$/, {
    message: 'adAccountId deve ser numérico (com ou sem prefixo "act_")',
  })
  adAccountId: string;

  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @IsEnum(MetaReportChannel)
  reportChannel: MetaReportChannel;

  @IsString()
  @IsNotEmpty()
  reportTarget: string;

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
