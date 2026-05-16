import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OrganizationBootstrapService } from '../onboarding/organization-bootstrap.service';

interface TokenPayload {
  sub: string;
  email: string;
  orgId: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** In-memory reset tokens store (dev only — replace with DB/Redis in prod) */
  private readonly resetTokens = new Map<
    string,
    { email: string; expiresAt: Date }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly bootstrap: OrganizationBootstrapService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const slug = dto.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: dto.organizationName, slug },
      });

      const user = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'OWNER',
        },
      });

      // Onboarding zero-config: popula pipeline, tags, sources, templates,
      // motivos de perda, canal manual e canal #geral do team chat.
      await this.bootstrap.bootstrap(org.id, tx, user.id);

      return { user, org };
    });

    return this.generateTokens({
      sub: result.user.id,
      email: result.user.email,
      orgId: result.org.id,
      role: 'OWNER',
    });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        memberships: {
          include: { organization: true },
          take: 1,
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException('No organization found');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens({
      sub: user.id,
      email: user.email,
      orgId: membership.organizationId,
      role: membership.role,
    });
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify<TokenPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      return this.generateTokens({
        sub: payload.sub,
        email: payload.email,
        orgId: payload.orgId,
        role: payload.role,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Forgot password — generates a reset token.
   * DEV MODE: returns the token directly (no email sending).
   * In production, send the token via email and never return it in the response.
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal whether the email exists
      return { message: 'If the email exists, a reset link has been sent.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    this.resetTokens.set(token, { email, expiresAt });
    this.logger.warn(`[DEV] Password reset token for ${email}: ${token}`);

    return {
      message: 'If the email exists, a reset link has been sent.',
      // DEV ONLY — remove in production
      _devToken: token,
    };
  }

  /**
   * Reset password — validates token and updates password.
   */
  async resetPassword(token: string, newPassword: string) {
    const entry = this.resetTokens.get(token);
    if (!entry) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (entry.expiresAt < new Date()) {
      this.resetTokens.delete(token);
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: entry.email },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    this.resetTokens.delete(token);
    return { message: 'Password has been reset successfully.' };
  }

  private generateTokens(payload: TokenPayload) {
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: payload.sub,
        email: payload.email,
      },
      organization: {
        id: payload.orgId,
        role: payload.role,
      },
    };
  }
}
