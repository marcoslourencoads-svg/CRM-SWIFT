import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @IsOptional()
  mentions?: any;
}

export class UpdateNoteDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;
}
