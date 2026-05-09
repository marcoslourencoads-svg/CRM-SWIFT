import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/create-note.dto';

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activities: ActivitiesService,
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
    const note = await this.prisma.note.create({
      data: {
        leadId,
        userId,
        content: dto.content,
        isPinned: dto.isPinned ?? false,
        mentions: dto.mentions ?? undefined,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    await this.activities.logActivity(leadId, userId, 'NOTE_ADDED', {
      preview: dto.content.slice(0, 80),
    });

    return note;
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
