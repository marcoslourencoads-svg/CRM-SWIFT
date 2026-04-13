import { IsArray, ValidateNested, IsString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class FieldValueItemDto {
  @IsString()
  @IsNotEmpty()
  fieldDefinitionId: string;

  value: any;
}

export class SetFieldValuesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldValueItemDto)
  values: FieldValueItemDto[];
}
