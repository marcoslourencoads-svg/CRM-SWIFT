import { IsEnum } from 'class-validator';
import { MembershipRole } from '@prisma/client';

export class UpdateRoleDto {
  @IsEnum(MembershipRole)
  role: MembershipRole;
}
