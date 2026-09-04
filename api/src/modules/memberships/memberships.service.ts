import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MembershipRole } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMembers(orgId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.id,
      role: m.role,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
    }));
  }

  async inviteMember(orgId: string, invitedBy: string, email: string, role: MembershipRole) {
    // Check if user is already a member
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMembership = await this.prisma.membership.findUnique({
        where: { userId_organizationId: { userId: existingUser.id, organizationId: orgId } },
      });
      if (existingMembership) {
        throw new ConflictException('User is already a member of this organization');
      }
    }

    // Check for pending invitation
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: { organizationId: orgId, email, status: 'PENDING' },
    });
    if (existingInvitation) {
      throw new ConflictException('A pending invitation already exists for this email');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    return this.prisma.invitation.create({
      data: {
        organizationId: orgId,
        invitedBy,
        email,
        role,
        token,
        expiresAt,
      },
    });
  }

  /**
   * Adiciona um membro direto, sem passar por convite por email: o admin
   * informa nome, email e uma senha provisoria, e a pessoa ja entra na
   * organizacao. Se o email ja tiver cadastro no sistema, reaproveitamos o
   * usuario e a senha dele permanece intacta.
   */
  async addMember(
    orgId: string,
    email: string,
    name: string,
    role: MembershipRole,
    password?: string,
  ) {
    // Dono da organizacao e definido no cadastro dela, nunca por aqui.
    if (role === 'OWNER') {
      throw new BadRequestException('Não é possível adicionar um membro como OWNER');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      const existingMembership = await this.prisma.membership.findUnique({
        where: {
          userId_organizationId: { userId: existingUser.id, organizationId: orgId },
        },
      });
      if (existingMembership) {
        throw new ConflictException('Este email já é membro da organização');
      }
    } else if (!password) {
      throw new BadRequestException(
        'Senha provisória é obrigatória para cadastrar um novo usuário',
      );
    }

    // Fora da transacao de proposito: o bcrypt custa ~250ms e seguraria a
    // conexao do banco a toa.
    const passwordHash = existingUser ? null : await bcrypt.hash(password as string, 12);

    const membership = await this.prisma.$transaction(async (tx) => {
      const user =
        existingUser ??
        (await tx.user.create({
          data: { name, email, passwordHash: passwordHash as string },
        }));

      const created = await tx.membership.create({
        data: { userId: user.id, organizationId: orgId, role },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      // Um convite pendente para este email nesta org perdeu a razao de existir
      // e continuaria aparecendo na lista de pendentes.
      await tx.invitation.updateMany({
        where: { organizationId: orgId, email, status: 'PENDING' },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      return created;
    });

    return {
      id: membership.id,
      role: membership.role,
      name: membership.user.name,
      email: membership.user.email,
      avatarUrl: membership.user.avatarUrl,
      // Avisa a UI que a senha informada nao foi aplicada: a pessoa ja tinha
      // conta e continua entrando com a senha antiga dela.
      userAlreadyExisted: Boolean(existingUser),
    };
  }

  async acceptInvite(token: string, name: string, password: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Invitation is no longer valid');
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Invitation has expired');
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({ where: { email: invitation.email } });

    if (!user) {
      const passwordHash = await bcrypt.hash(password, 10);
      user = await this.prisma.user.create({
        data: {
          name,
          email: invitation.email,
          passwordHash,
        },
      });
    }

    // Create membership and mark invitation as accepted in a transaction
    const [membership] = await this.prisma.$transaction([
      this.prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      }),
    ]);

    return membership;
  }

  async updateRole(orgId: string, membershipId: string, role: MembershipRole) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId: orgId },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    return this.prisma.membership.update({
      where: { id: membershipId },
      data: { role },
    });
  }

  async removeMember(orgId: string, membershipId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId: orgId },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    // Can't remove the last OWNER
    if (membership.role === 'OWNER') {
      const ownerCount = await this.prisma.membership.count({
        where: { organizationId: orgId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner of the organization');
      }
    }

    return this.prisma.membership.delete({ where: { id: membershipId } });
  }

  async listInvitations(orgId: string) {
    return this.prisma.invitation.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
