import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { TeamChannelType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TeamChatPublisher } from './team-chat.publisher';

interface CreateChannelDto {
  name: string;
  type?: TeamChannelType;
  description?: string;
  memberIds?: string[];
}

@Injectable()
export class TeamChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: TeamChatPublisher,
  ) {}

  // ---------- Channels ----------

  /**
   * Lista canais do user: PUBLIC da org + PRIVATE/DIRECT em que ele é membro.
   */
  async listMyChannels(orgId: string, userId: string) {
    const channels = await this.prisma.teamChannel.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { type: 'PUBLIC' },
          { members: { some: { userId } } },
        ],
      },
      include: {
        members: { select: { userId: true, lastReadAt: true } },
        _count: { select: { messages: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { id: true, body: true, authorId: true, createdAt: true },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    // Calcula unread por canal
    return channels.map((ch) => {
      const myMember = ch.members.find((m) => m.userId === userId);
      const lastMsg = ch.messages[0];
      const hasUnread =
        !!lastMsg &&
        (!myMember?.lastReadAt || lastMsg.createdAt > myMember.lastReadAt);
      return {
        id: ch.id,
        name: ch.name,
        type: ch.type,
        description: ch.description,
        memberCount: ch.members.length,
        messageCount: ch._count.messages,
        lastMessage: lastMsg,
        hasUnread,
      };
    });
  }

  async getChannel(orgId: string, userId: string, channelId: string) {
    const channel = await this.prisma.teamChannel.findFirst({
      where: { id: channelId, organizationId: orgId },
      include: {
        members: { select: { userId: true, joinedAt: true, lastReadAt: true } },
      },
    });
    if (!channel) throw new NotFoundException('Canal não encontrado');

    if (channel.type !== 'PUBLIC' && !channel.members.some((m) => m.userId === userId)) {
      throw new ForbiddenException('Você não é membro desse canal');
    }
    return channel;
  }

  async createChannel(orgId: string, userId: string, dto: CreateChannelDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Nome obrigatório');

    const memberIds = new Set([userId, ...(dto.memberIds ?? [])]);

    return this.prisma.teamChannel.create({
      data: {
        organizationId: orgId,
        name: dto.name.trim(),
        type: dto.type ?? 'PUBLIC',
        description: dto.description ?? null,
        createdBy: userId,
        members: {
          create: Array.from(memberIds).map((uid) => ({ userId: uid })),
        },
      },
      include: { members: true },
    });
  }

  async addMember(orgId: string, requesterId: string, channelId: string, userId: string) {
    const channel = await this.getChannel(orgId, requesterId, channelId);
    return this.prisma.teamChannelMember.upsert({
      where: { channelId_userId: { channelId: channel.id, userId } },
      update: {},
      create: { channelId: channel.id, userId },
    });
  }

  async removeMember(orgId: string, requesterId: string, channelId: string, userId: string) {
    const channel = await this.getChannel(orgId, requesterId, channelId);
    if (channel.type === 'DIRECT') {
      throw new BadRequestException('DMs não permitem remover membro');
    }
    return this.prisma.teamChannelMember.deleteMany({
      where: { channelId: channel.id, userId },
    });
  }

  // ---------- Messages ----------

  async listMessages(orgId: string, userId: string, channelId: string, limit = 100) {
    await this.getChannel(orgId, userId, channelId);
    return this.prisma.teamMessage.findMany({
      where: { channelId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async sendMessage(orgId: string, userId: string, channelId: string, body: string) {
    if (!body?.trim()) throw new BadRequestException('Mensagem vazia');

    const channel = await this.getChannel(orgId, userId, channelId);

    const message = await this.prisma.teamMessage.create({
      data: {
        channelId: channel.id,
        authorId: userId,
        body: body.trim(),
      },
    });

    // Marca como lido pro próprio autor
    await this.prisma.teamChannelMember.upsert({
      where: { channelId_userId: { channelId: channel.id, userId } },
      update: { lastReadAt: new Date() },
      create: { channelId: channel.id, userId, lastReadAt: new Date() },
    });

    // Notifica via SSE pra todos os membros (no caso de PUBLIC, busca a org inteira)
    let recipients: string[];
    if (channel.type === 'PUBLIC') {
      const all = await this.prisma.membership.findMany({
        where: { organizationId: orgId },
        select: { userId: true },
      });
      recipients = all.map((m) => m.userId);
    } else {
      recipients = channel.members.map((m) => m.userId);
    }

    this.publisher.publishToUsers(recipients, 'message.created', {
      channelId: channel.id,
      message,
    });

    return message;
  }

  async markAsRead(orgId: string, userId: string, channelId: string) {
    await this.getChannel(orgId, userId, channelId);
    return this.prisma.teamChannelMember.upsert({
      where: { channelId_userId: { channelId, userId } },
      update: { lastReadAt: new Date() },
      create: { channelId, userId, lastReadAt: new Date() },
    });
  }

  /**
   * Garante 1 canal #geral por org. Chamado no bootstrap.
   */
  async ensureGeneralChannel(orgId: string, ownerId: string) {
    const existing = await this.prisma.teamChannel.findFirst({
      where: { organizationId: orgId, name: 'geral', type: 'PUBLIC' },
    });
    if (existing) return existing;

    return this.prisma.teamChannel.create({
      data: {
        organizationId: orgId,
        name: 'geral',
        type: 'PUBLIC',
        description: 'Canal geral do time',
        createdBy: ownerId,
        members: { create: [{ userId: ownerId }] },
      },
    });
  }
}
