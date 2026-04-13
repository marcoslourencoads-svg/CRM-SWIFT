import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsArray,
  ArrayMinSize,
  IsOptional,
  IsObject,
} from 'class-validator';

export class CreateWebhookDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  url: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  events: string[];

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;
}
