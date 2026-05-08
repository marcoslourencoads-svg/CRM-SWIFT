import { IsString, IsNotEmpty, IsOptional, IsEmail, IsArray, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class CreatePublicLeadDto {
  @Transform(emptyToUndefined)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Transform(emptyToUndefined)
  @IsEmail()
  @IsOptional()
  email?: string;

  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  phone?: string;

  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsNotEmpty()
  pipelineId!: string;

  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  sourceId?: string;

  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  utm_source?: string;

  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  utm_medium?: string;

  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  utm_campaign?: string;

  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  utm_term?: string;

  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  utm_content?: string;

  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  referrer_url?: string;

  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  landing_page?: string;

  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  gclid?: string;

  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  fbclid?: string;

  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagNames?: string[];

  @IsObject()
  @IsOptional()
  customFields?: Record<string, string | number | boolean | string[] | null>;
}
