import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferenceDto {
  @IsString()
  eventType: string;

  @IsBoolean()
  @IsOptional()
  inApp?: boolean;

  @IsBoolean()
  @IsOptional()
  email?: boolean;
}
