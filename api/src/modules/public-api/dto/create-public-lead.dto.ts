import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';

export class CreatePublicLeadDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsNotEmpty()
  pipelineId: string;

  @IsString()
  @IsOptional()
  sourceId?: string;

  @IsString()
  @IsOptional()
  utm_source?: string;

  @IsString()
  @IsOptional()
  utm_medium?: string;

  @IsString()
  @IsOptional()
  utm_campaign?: string;

  @IsString()
  @IsOptional()
  utm_term?: string;

  @IsString()
  @IsOptional()
  utm_content?: string;

  @IsString()
  @IsOptional()
  referrer_url?: string;

  @IsString()
  @IsOptional()
  landing_page?: string;

  @IsString()
  @IsOptional()
  gclid?: string;

  @IsString()
  @IsOptional()
  fbclid?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
