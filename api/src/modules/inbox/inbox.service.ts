import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ChannelProvider,
  ChannelType,
  ConversationStatus,
  MessageDirection,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InboxProviderRegistry } from './providers/provider.registry';
import { InboxPublisher } from './inbox.publisher';

interface CreateChannelDto {
  type: ChannelType;
  provider?: ChannelProvider;
  name: string;
  config?: Record<string, unknown>;
}

interface UpdateChannelDto {
  name?: string;
  provider?: ChannelProvider;
  config?: Record<string, unknown>;
  isActive?: boolean;
}

interface ListConversationsParams {
  status?: ConversationStatus;
  channelId?: string;
  assignedTo?: string;
  search?: string;
  limit?: number;
}

interface SendOutboundDto {
  channelId?: string;
  body: string;
  leadId?: string;
  contactPhone?: string;
  contactName?: string;
}

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: InboxProviderRegistry,
    private readonly publisher: InboxPublisher,
  ) {}

  // ---------- Channels ----------

  listChannels(orgId: string) {
    return this.prisma.channel.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });
  }

  createChannel(orgId: string, dto: CreateChannelDto) {
    return this.prisma.channel.create({
      data: {
        organizationId: orgId,
        type: dto.type,
        provider: dto.provider ?? 'MANUAL',
        name: dto.name,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async updateChannel(orgId: string, id: string, dto: UpdateChannelDto) {
    const channel = await this.prisma.channel.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!channel) throw new NotFoundException('Canal não encontrado');

    return this.prisma.channel.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
        ...(dto.config !== undefined
          ? { config: dto.config as Prisma.InputJsonValue }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async removeChannel(orgId: string, id: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!channel) throw new NotFoundException('Canal não encontrado');
    return this.prisma.channel.delete({ where: { id } });
  }

  /**
   * Garante que existe pelo menos 1 canal manual de WhatsApp pra org.
   * Chamado lazy quando alguém manda primeira mensagem outbound.
   */
  async ensureDefaultWhatsappChannel(orgId: string) {
    const existing = await this.prisma.channel.findFirst({
      where: { organizationId: orgId, type: 'WHATSAPP', isActive: true },
    });
    if (existing) return existing;

    return this.prisma.channel.create({
      data: {
        organizationId: orgId,
        type: 'WHATSAPP',
        provider: 'MANUAL',
        name: 'WhatsApp (manual)',
        config: {},
      },
    });
  }

  // ---------- Conversations ----------

  async listConversations(orgId: string, params: ListConversationsParams = {}) {
    const where: Prisma.ConversationWhereInput = {
      organizationId: orgId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.channelId ? { channelId: params.channelId } : {}),
      ...(params.assignedTo ? { assignedTo: params.assignedTo } : {}),
      ...(params.search
        ? {
            OR: [
              { contactName: { contains: params.search, mode: 'insensitive' } },
              { contactPhone: { contains: params.search } },
            ],
          }
        : {}),
    };

    return this.prisma.conversation.findMany({
      where,
      take: params.limit ?? 100,
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        channel: { select: { id: true, name: true, type: true, provider: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            body: true,
            direction: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async getConversation(orgId: string, id: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id, organizationId: orgId },
      include: {
        channel: { select: { id: true, name: true, type: true, provider: true } },
      },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada');
    return conv;
  }

  async listMessages(orgId: string, conversationId: string, limit = 200) {
    await this.getConversation(orgId, conversationId);
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async updateConversation(
    orgId: string,
    id: string,
    patch: { status?: ConversationStatus; assignedTo?: string | null; leadId?: string | null },
  ) {
    await this.getConversation(orgId, id);
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.assignedTo !== undefined ? { assignedTo: patch.assignedTo } : {}),
        ...(patch.leadId !== undefined ? { leadId: patch.leadId } : {}),
      },
    });
    this.publisher.publish(orgId, 'conversation.updated', updated);
    return updated;
  }

  async markAsRead(orgId: string, id: string) {
    await this.getConversation(orgId, id);
    return this.prisma.conversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });
  }

  // ---------- Send (outbound) ----------

  async sendOutbound(orgId: string, userId: string, dto: SendOutboundDto) {
    if (!dto.body?.trim()) {
      throw new BadRequestException('Mensagem vazia');
    }

    const channel = dto.channelId
      ? await this.prisma.channel.findFirst({
          where: { id: dto.channelId, organizationId: orgId, isActive: true },
        })
      : await this.ensureDefaultWhatsappChannel(orgId);
    if (!channel) throw new NotFoundException('Canal não encontrado ou inativo');

    // Tenta achar conversa existente por lead OU por phone
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        organizationId: orgId,
        channelId: channel.id,
        ...(dto.leadId
          ? { leadId: dto.leadId }
          : dto.contactPhone
            ? { contactPhone: dto.contactPhone }
            : { id: '__never__' }),
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          organizationId: orgId,
          channelId: channel.id,
          leadId: dto.leadId ?? null,
          contactPhone: dto.contactPhone ?? null,
          contactName: dto.contactName ?? null,
          status: 'OPEN',
          assignedTo: userId,
        },
      });
      this.publisher.publish(orgId, 'conversation.created', conversation);
    }

    // Dispara via provider
    const provider = this.registry.get(channel.provider);
    const result = await provider.send({
      conversationId: conversation.id,
      body: dto.body,
      contactPhone: conversation.contactPhone,
      channelConfig: (channel.config as Record<string, unknown>) ?? {},
    });

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        body: dto.body,
        status: result.status === 'SENT' ? 'SENT' : result.status === 'QUEUED' ? 'QUEUED' : 'FAILED',
        externalId: result.externalId,
        sentAt: result.status === 'SENT' ? new Date() : null,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    this.publisher.publish(orgId, 'message.created', {
      conversationId: conversation.id,
      message,
    });

    return { conversation, message, providerResult: result };
  }

  // ---------- Inbound (futuro: webhook do provider) ----------

  async recordInbound(
    orgId: string,
    channelId: string,
    payload: {
      contactPhone: string;
      contactName?: string;
      body: string;
      externalId?: string;
      mediaUrl?: string;
      mediaType?: string;
    },
  ) {
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        organizationId: orgId,
        channelId,
        contactPhone: payload.contactPhone,
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          organizationId: orgId,
          channelId,
          contactPhone: payload.contactPhone,
          contactName: payload.contactName ?? null,
          status: 'OPEN',
        },
      });
      this.publisher.publish(orgId, 'conversation.created', conversation);
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: MessageDirection.INBOUND,
        body: payload.body,
        externalId: payload.externalId ?? null,
        mediaUrl: payload.mediaUrl ?? null,
        mediaType: payload.mediaType ?? null,
        status: 'DELIVERED',
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
      },
    });

    this.publisher.publish(orgId, 'message.created', {
      conversationId: conversation.id,
      message,
    });

    return { conversation, message };
  }
}
