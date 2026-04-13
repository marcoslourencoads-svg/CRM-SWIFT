import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  async create(orgId: string, userId: string, dto: CreateApiKeyDto) {
    const rawKey = randomBytes(32).toString('hex');
    const prefix = rawKey.slice(0, 8);
    const keyHash = this.hashKey(rawKey);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        organizationId: orgId,
        createdBy: userId,
        name: dto.name,
        keyHash,
        prefix,
        scopes: dto.scopes ?? ['leads:write'],
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      prefix,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
    };
  }

  async findAll(orgId: string) {
    return this.prisma.apiKey.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(orgId: string, id: string) {
    return this.prisma.apiKey.update({
      where: { id, organizationId: orgId },
      data: { isActive: false },
    });
  }

  async validateKey(rawKey: string) {
    const keyHash = this.hashKey(rawKey);

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
    });

    if (!apiKey) return null;
    if (!apiKey.isActive) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    // Update lastUsedAt (fire-and-forget)
    this.prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    return apiKey;
  }
}
