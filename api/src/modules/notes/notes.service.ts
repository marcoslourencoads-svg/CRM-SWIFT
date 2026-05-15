import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/create-note.dto';

/**
 * Captura @token onde token = letras, números, ponto, hífen, underscore.
 * Match com User.name (case-insensitive, primeiro nome) ou User.email (parte antes do @).
 */
const MENTION_REGEX = /@([a-zA-ZÀ-ÿ0-9._-]{2,40})/g;

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activities: ActivitiesService,
    private readonly notifications: NotificationsService,
  ) {}

  async findByLead(leadId: string) {
    return this.prisma.note.findMany({
      where: { leadId, deletedAt: null },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async create(leadId: string, userId: string, dto: CreateNoteDto) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
      select: { id: true, title: true, organizationId: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const mentioned = await this.resolveMentions(lead.organizationId, dto.content, userId);

    const note = await this.prisma.note.create({
      data: {
        leadId,
        userId,
        content: dto.content,
        isPinned: dto.isPinned ?? false,
        mentions:
          mentioned.length > 0
            ? (mentioned.map((m) => ({ userId: m.id, name: m.name })) as any)
            : dto.mentions ?? undefined,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    await this.activities.logActivity(leadId, userId, 'NOTE_ADDED', {
      preview: dto.content.slice(0, 80),
      mentions: mentioned.map((m) => m.id),
    });

    const author = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    for (const m of mentioned) {
      await this.notifications.create(
        lead.organizationId,
        m.id,
        'MENTION',
        `${author?.name ?? 'Alguém'} mencionou você em "${lead.title}"`,
        dto.content.slice(0, 140),
        { leadId, noteId: note.id, mentionedBy: userId },
      );
    }

    return note;
  }

  /**
   * Extrai @tokens do content e resolve pra users membros da org.
   * Match em User.name (primeira palavra) ou User.email (parte antes do @).
   * Exclui o próprio autor.
   */
  private async resolveMentions(
    orgId: string,
    content: string,
    authorId: string,
  ): Promise<{ id: string; name: string }[]> {
    const matches = Array.from(content.matchAll(MENTION_REGEX)).map((m) =>
      m[1].toLowerCase(),
    );
    if (matches.length === 0) return [];

    const memberships = await this.prisma.membership.findMany({
      where: { organizationId: orgId, userId: { not: authorId } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const matched = new Map<string, { id: string; name: string }>();
    for (const token of matches) {
      for (const mem of memberships) {
        const firstName = mem.user.name.split(' ')[0]?.toLowerCase() ?? '';
        const fullName = mem.user.name.toLowerCase().replace(/\s+/g, '');
        const emailLocal = mem.user.email.split('@')[0]?.toLowerCase() ?? '';
        if (firstName === token || fullName === token || emailLocal === token) {
          matched.set(mem.user.id, { id: mem.user.id, name: mem.user.name });
        }
      }
    }
    return Array.from(matched.values());
  }

  async update(id: string, dto: UpdateNoteDto) {
    const note = await this.prisma.note.findFirst({
      where: { id, deletedAt: null },
    });
    if (!note) throw new NotFoundException('Note not found');

    return this.prisma.note.update({
      where: { id },
      data: {
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.isPinned !== undefined ? { isPinned: dto.isPinned } : {}),
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async softDelete(id: string) {
    const note = await this.prisma.note.findFirst({
      where: { id, deletedAt: null },
    });
    if (!note) throw new NotFoundException('Note not found');

    return this.prisma.note.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
