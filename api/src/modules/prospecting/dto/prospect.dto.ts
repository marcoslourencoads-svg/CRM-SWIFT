import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
  IsArray,
  IsDateString,
  Min,
  ArrayNotEmpty,
} from 'class-validator';
import { ProspectStage, ProspectChannel, TouchOutcome } from '@prisma/client';

// Só o nome é obrigatório: a captura na rua precisa ser de um campo só,
// o resto se completa depois na ficha.
export class CreateProspectDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  business?: string;

  @IsString()
  @IsOptional()
  handle?: string;

  @IsString()
  @IsOptional()
  profileUrl?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  niche?: string;

  @IsBoolean()
  @IsOptional()
  hasAds?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  followers?: number;

  @IsEnum(ProspectChannel)
  @IsOptional()
  channel?: ProspectChannel;

  @IsString()
  @IsOptional()
  listId?: string;

  @IsString()
  @IsOptional()
  ownerId?: string;

  @IsDateString()
  @IsOptional()
  nextActionAt?: string;

  // Observação escrita na hora do cadastro. Vira a primeira entrada do
  // diário de bordo, com a etapa carimbada.
  @IsString()
  @IsOptional()
  observacao?: string;

  // "Já abordei este": registra o primeiro toque junto com o cadastro,
  // para não precisar abrir a ficha em seguida só para marcar isso.
  @IsBoolean()
  @IsOptional()
  jaAbordado?: boolean;

  @IsEnum(TouchOutcome)
  @IsOptional()
  primeiroToqueResultado?: TouchOutcome;

  @IsString()
  @IsOptional()
  approachId?: string;

  @IsDateString()
  @IsOptional()
  abordadoEm?: string;
}

// `stage` e os carimbos de etapa não entram aqui de propósito: quem os
// deriva é o service, senão volta a incoerência da planilha (fechou
// contrato sem ter respondido).
export class UpdateProspectDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  business?: string;

  @IsString()
  @IsOptional()
  handle?: string;

  @IsString()
  @IsOptional()
  profileUrl?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  niche?: string;

  @IsBoolean()
  @IsOptional()
  hasAds?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  followers?: number;

  @IsEnum(ProspectChannel)
  @IsOptional()
  channel?: ProspectChannel;

  @IsString()
  @IsOptional()
  listId?: string;

  @IsString()
  @IsOptional()
  ownerId?: string;

  @IsDateString()
  @IsOptional()
  nextActionAt?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  dealValue?: number;
}

export class RegisterTouchDto {
  @IsEnum(ProspectChannel)
  @IsOptional()
  channel?: ProspectChannel;

  @IsString()
  @IsOptional()
  approachId?: string;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsEnum(TouchOutcome)
  @IsOptional()
  outcome?: TouchOutcome;

  @IsDateString()
  @IsOptional()
  sentAt?: string;

  // Sobrescreve a data calculada pela cadência da lista.
  @IsDateString()
  @IsOptional()
  nextActionAt?: string;
}

export class ChangeStageDto {
  @IsEnum(ProspectStage)
  stage!: ProspectStage;

  @IsInt()
  @Min(0)
  @IsOptional()
  dealValue?: number;

  @IsString()
  @IsOptional()
  lostReasonId?: string;

  @IsString()
  @IsOptional()
  lostNote?: string;

  @IsDateString()
  @IsOptional()
  nextActionAt?: string;
}

export class ConvertProspectDto {
  @IsString()
  @IsNotEmpty()
  pipelineId!: string;

  @IsString()
  @IsOptional()
  statusId?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedValue?: number;

  @IsString()
  @IsOptional()
  assigneeId?: string;
}

export class BulkProspectDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];

  @IsString()
  @IsOptional()
  ownerId?: string;

  @IsString()
  @IsOptional()
  listId?: string;

  @IsEnum(ProspectStage)
  @IsOptional()
  stage?: ProspectStage;
}

export class UpsertProspectNoteDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}
