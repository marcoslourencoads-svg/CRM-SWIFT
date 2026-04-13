import {
  IsString,
  IsOptional,
  IsUrl,
  IsArray,
  IsObject,
  IsBoolean,
} from 'class-validator';

export class UpdateWebhookDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  url?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  events?: string[];

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
