import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsArray } from 'class-validator';

export class CreateTransitionRuleDto {
  @IsString()
  @IsNotEmpty()
  fromStatusId: string;

  @IsString()
  @IsNotEmpty()
  toStatusId: string;

  @IsBoolean()
  @IsOptional()
  isAllowed?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredFields?: string[];
}
