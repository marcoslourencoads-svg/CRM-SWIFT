import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { MembershipRole } from '@prisma/client';

export class AddMemberDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  /**
   * Senha provisoria. Obrigatoria apenas quando o email ainda nao tem cadastro
   * no sistema — se a pessoa ja tem conta, ela entra com a senha dela e este
   * campo e ignorado (nunca sobrescrevemos a senha de um usuario existente).
   */
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsEnum(MembershipRole)
  role: MembershipRole;
}
