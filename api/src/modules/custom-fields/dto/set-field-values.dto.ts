import { IsArray, ValidateNested, IsString, IsNotEmpty, Allow } from 'class-validator';
import { Type } from 'class-transformer';

export class FieldValueItemDto {
  @IsString()
  @IsNotEmpty()
  fieldDefinitionId!: string;

  @Allow()
  value: any;
}

export class SetFieldValuesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldValueItemDto)
  values: FieldValueItemDto[];
}
