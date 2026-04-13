import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePipelineDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
