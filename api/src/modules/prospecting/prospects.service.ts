import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, ProspectStage, ProspectChannel, TouchOutcome } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivitiesService } from '../activities/activities.service';
import {
  CreateProspectDto,
  UpdateProspectDto,
  RegisterTouchDto,
  ChangeStageDto,
  ConvertProspectDto,
  BulkProspectDto,
  UpsertProspectNoteDto,
} from './dto/prospect.dto';

// Ordem do funil. É esta escala que impede o estado incoerente da
// planilha (fechou contrato sem nunca ter respondido): avançar para um
// posto preenche, para trás, todo carimbo que ainda estiver vazio.
const STAGE_RANK: Record<ProspectStage, number> = {
  NEW: 0,
  CONTACTED: 1,
  FOLLOW_UP: 2,
  RESPONDED: 3,
  MEETING_SET: 4,
  MEETING_DONE: 5,
  WON: 6,
  LOST: -1,
  DISQUALIFIED: -1,
};

// Carimbo que cada posto da escala grava. FOLLOW_UP não tem carimbo
// próprio: continua sendo a mesma coorte de abordados.
const STAGE_STAMP: Partial<Record<ProspectStage, string>> = {
  CONTACTED: 'firstContactedAt',
  RESPONDED: 'respondedAt',
  MEETING_SET: 'meetingSetAt',
  MEETING_DONE: 'meetingHeldAt',
  WON: 'wonAt',
};

// Cadencia usada quando o prospect nao esta em nenhuma lista. Sem este
// fallback o follow-up simplesmente nunca seria agendado e o prospect
// cairia direto em "cadencia esgotada" — parecendo que o sistema
// desistiu dele, sem erro nenhum na tela.
const DEFAULT_CADENCE = [2, 4, 7];

const TERMINAL_STAGES: ProspectStage[] = ['WON', 'LOST', 'DISQUALIFIED'];
const REPLY_OUTCOMES: TouchOutcome[] = ['REPLIED_POSITIVE', 'REPLIED_NEGATIVE'];

const PROSPECT_INCLUDE = {
  owner: { select: { id: true, name: true, email: true } },
  list: { select: { id: true, name: true, cadenceDays: true } },
  touches: {
    orderBy: { sequence: 'asc' as const },
    include: { approach: { select: { id: true, name: true } } },
  },
  notes: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' as const },
    include: { user: { select: { id: true, name: true } } },
  },
};

export interface ProspectFilters {
  stage?: ProspectStage;
  ownerId?: string;
  listId?: string;
  channel?: ProspectChannel;
  hasAds?: boolean;
  niche?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

@Injectable()
export class ProspectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activities: ActivitiesService,
    private readonly eventBus: EventEmitter2,
  ) {}

  // ─── Leitura ────────────────────────────────────────────────

  async findAll(orgId: string, filters: ProspectFilters = {}) {
    const take = Math.min(filters.limit ?? 200, 1000);
    const where: Prisma.ProspectWhereInput = {
      organizationId: orgId,
      deletedAt: null,
      ...(filters.stage ? { stage: filters.stage } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
      ...(filters.listId ? { listId: filters.listId } : {}),
      ...(filters.channel ? { channel: filters.channel } : {}),
      ...(filters.hasAds !== undefined ? { hasAds: filters.hasAds } : {}),
      ...(filters.niche ? { niche: { equals: filters.niche, mode: 'insensitive' as const } } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' as const } },
              { business: { contains: filters.search, mode: 'insensitive' as const } },
              { handle: { contains: filters.search, mode: 'insensitive' as const } },
              { niche: { contains: filters.search, mode: 'insensitive' as const } },
              { phone: { contains: filters.search, mode: 'insensitive' as const } },
              { email: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    return this.prisma.prospect.findMany({
      where,
      include: PROSPECT_INCLUDE,
      orderBy: [{ nextActionAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take,
      ...(filters.cursor ? { skip: 1, cursor: { id: filters.cursor } } : {}),
    });
  }

  async findOne(orgId: string, id: string) {
    const prospect = await this.prisma.prospect.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: PROSPECT_INCLUDE,
    });
    if (!prospect) throw new NotFoundException('Prospect nao encontrado');
    return prospect;
  }

  // A fila do dia. É a tela que a planilha nunca teve: em vez de ler
  // 11 colunas para descobrir quem está pendente, o nextActionAt diz.
  async getQueue(orgId: string, ownerId?: string, tzOffsetMin?: number) {
    // "Hoje" precisa ser o hoje de QUEM OLHA, nao o do servidor. Em
    // producao a API roda em UTC; para um usuario em UTC-3, das 21h a
    // meia-noite o servidor ja virou o dia e o compromisso de amanha
    // apareceria como sendo de hoje. O front manda o proprio offset
    // (Date.getTimezoneOffset, em minutos); sem ele, cai no servidor.
    const offset = tzOffsetMin ?? new Date().getTimezoneOffset();
    const agoraLocal = new Date(Date.now() - offset * 60 * 1000);

    const startOfToday = new Date(
      Date.UTC(
        agoraLocal.getUTCFullYear(),
        agoraLocal.getUTCMonth(),
        agoraLocal.getUTCDate(),
      ) + offset * 60 * 1000,
    );
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

    const base: Prisma.ProspectWhereInput = {
      organizationId: orgId,
      deletedAt: null,
      stage: { notIn: TERMINAL_STAGES },
      ...(ownerId ? { ownerId } : {}),
    };

    const [atrasados, hoje, naoIniciados, cadenciaEsgotada] = await Promise.all([
      this.prisma.prospect.findMany({
        where: { ...base, nextActionAt: { lt: startOfToday } },
        include: PROSPECT_INCLUDE,
        orderBy: { nextActionAt: 'asc' },
        take: 200,
      }),
      this.prisma.prospect.findMany({
        where: { ...base, nextActionAt: { gte: startOfToday, lte: endOfToday } },
        include: PROSPECT_INCLUDE,
        orderBy: { nextActionAt: 'asc' },
        take: 200,
      }),
      this.prisma.prospect.findMany({
        where: { ...base, stage: 'NEW', nextActionAt: null },
        include: PROSPECT_INCLUDE,
        orderBy: { createdAt: 'asc' },
        take: 200,
      }),
      // Passou por toda a cadência da lista e ninguém respondeu.
      // Não vira perda automática: quem decide enterrar é o operador.
      this.prisma.prospect.findMany({
        where: {
          ...base,
          nextActionAt: null,
          stage: { in: ['CONTACTED', 'FOLLOW_UP'] },
        },
        include: PROSPECT_INCLUDE,
        orderBy: { lastTouchAt: 'asc' },
        take: 200,
      }),
    ]);

    return {
      atrasados,
      hoje,
      naoIniciados,
      cadenciaEsgotada,
      counts: {
        atrasados: atrasados.length,
        hoje: hoje.length,
        naoIniciados: naoIniciados.length,
        cadenciaEsgotada: cadenciaEsgotada.length,
      },
    };
  }

  // ─── Escrita ────────────────────────────────────────────────

  async create(orgId: string, userId: string, dto: CreateProspectDto) {
    const handle = this.normalizeHandle(dto.handle, dto.profileUrl);

    const criado = await this.prisma.prospect.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        business: dto.business,
        handle,
        profileUrl: dto.profileUrl ?? this.profileUrlFromHandle(handle, dto.channel),
        phone: dto.phone,
        email: dto.email,
        city: dto.city,
        niche: dto.niche,
        hasAds: dto.hasAds,
        followers: dto.followers,
        channel: dto.channel ?? 'INSTAGRAM',
        listId: dto.listId,
        ownerId: dto.ownerId ?? userId,
        nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : null,
        // A observação do cadastro vira a primeira entrada do diário.
        ...(dto.observacao?.trim()
          ? {
              notes: {
                create: {
                  userId,
                  stage: 'NEW' as ProspectStage,
                  content: dto.observacao.trim(),
                },
              },
            }
          : {}),
      },
      include: PROSPECT_INCLUDE,
    });

    // "Já abordei este": registra o primeiro toque junto do cadastro, em
    // vez de obrigar a abrir a ficha logo em seguida só para marcar isso.
    // Reusa registerTouch para a cadência e os carimbos saírem iguais aos
    // de um toque registrado à mão.
    if (dto.jaAbordado) {
      return this.registerTouch(orgId, userId, criado.id, {
        outcome: dto.primeiroToqueResultado ?? 'NO_REPLY',
        approachId: dto.approachId,
        sentAt: dto.abordadoEm,
        // Data escolhida no cadastro vence a cadência: se o operador já
        // combinou o retorno, é essa a data que vale.
        ...(dto.nextActionAt ? { nextActionAt: dto.nextActionAt } : {}),
      });
    }

    return criado;
  }

  // ─── Diário de bordo ────────────────────────────────────────

  // A etapa é copiada no momento da escrita: avançar depois não pode
  // reescrever em que ponto a observação foi feita.
  async addNote(orgId: string, userId: string, id: string, dto: UpsertProspectNoteDto) {
    const prospect = await this.findOne(orgId, id);
    await this.prisma.prospectNote.create({
      data: {
        prospectId: prospect.id,
        userId,
        stage: prospect.stage,
        content: dto.content.trim(),
      },
    });
    return this.findOne(orgId, id);
  }

  async updateNote(orgId: string, noteId: string, dto: UpsertProspectNoteDto) {
    const note = await this.prisma.prospectNote.findFirst({
      where: { id: noteId, deletedAt: null, prospect: { organizationId: orgId } },
    });
    if (!note) throw new NotFoundException('Anotacao nao encontrada');

    return this.prisma.prospectNote.update({
      where: { id: noteId },
      data: { content: dto.content.trim() },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  async removeNote(orgId: string, noteId: string) {
    const note = await this.prisma.prospectNote.findFirst({
      where: { id: noteId, deletedAt: null, prospect: { organizationId: orgId } },
    });
    if (!note) throw new NotFoundException('Anotacao nao encontrada');

    await this.prisma.prospectNote.update({
      where: { id: noteId },
      data: { deletedAt: new Date() },
    });
  }

  // Compromissos com hora marcada dentro de uma janela — o que alimenta
  // o calendário.
  async getAgenda(orgId: string, from: string, to: string, ownerId?: string) {
    return this.prisma.prospect.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        stage: { notIn: TERMINAL_STAGES },
        nextActionAt: { gte: new Date(from), lte: new Date(to) },
        ...(ownerId ? { ownerId } : {}),
      },
      include: PROSPECT_INCLUDE,
      orderBy: { nextActionAt: 'asc' },
      take: 500,
    });
  }

  async update(orgId: string, id: string, dto: UpdateProspectDto) {
    await this.findOne(orgId, id);
    const handle = dto.handle !== undefined ? this.normalizeHandle(dto.handle) : undefined;
    return this.prisma.prospect.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.business !== undefined ? { business: dto.business } : {}),
        ...(handle !== undefined ? { handle } : {}),
        ...(dto.profileUrl !== undefined ? { profileUrl: dto.profileUrl } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.niche !== undefined ? { niche: dto.niche } : {}),
        ...(dto.hasAds !== undefined ? { hasAds: dto.hasAds } : {}),
        ...(dto.followers !== undefined ? { followers: dto.followers } : {}),
        ...(dto.channel !== undefined ? { channel: dto.channel } : {}),
        ...(dto.listId !== undefined ? { listId: dto.listId || null } : {}),
        ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId || null } : {}),
        ...(dto.dealValue !== undefined ? { dealValue: dto.dealValue } : {}),
        ...(dto.nextActionAt !== undefined
          ? { nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : null }
          : {}),
      },
      include: PROSPECT_INCLUDE,
    });
  }

  async remove(orgId: string, id: string) {
    await this.findOne(orgId, id);
    await this.prisma.prospect.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // O coração da operação: registra um toque, avança a etapa e agenda
  // o próximo sozinho a partir da cadência da lista.
  async registerTouch(orgId: string, userId: string, id: string, dto: RegisterTouchDto) {
    const prospect = await this.findOne(orgId, id);

    const sequence = prospect.touchCount + 1;
    const sentAt = dto.sentAt ? new Date(dto.sentAt) : new Date();
    const outcome = dto.outcome ?? 'NO_REPLY';
    const channel = dto.channel ?? prospect.channel;
    const replied = REPLY_OUTCOMES.includes(outcome);

    if (dto.approachId) {
      const approach = await this.prisma.prospectApproach.findFirst({
        where: { id: dto.approachId, organizationId: orgId },
        select: { id: true },
      });
      if (!approach) throw new BadRequestException('Abordagem nao encontrada');
    }

    // Sem resposta ainda: a cadência da lista diz quando insistir.
    // Esgotada a cadência, nextActionAt fica nulo e o prospect cai no
    // balde "cadência esgotada" da fila — sinalizado, não morto.
    const cadence = prospect.list?.cadenceDays?.length
      ? prospect.list.cadenceDays
      : DEFAULT_CADENCE;
    let nextActionAt: Date | null = null;
    if (dto.nextActionAt) {
      nextActionAt = new Date(dto.nextActionAt);
    } else if (!replied) {
      const intervalDays = cadence[sequence - 1];
      if (intervalDays !== undefined) {
        nextActionAt = new Date(sentAt.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      }
    }

    // Uma resposta negativa continua sendo resposta: entra na taxa de
    // resposta do funil. Enterrar o prospect é ato separado (LOST).
    let stage = prospect.stage;
    if (replied) {
      stage = this.maxStage(stage, 'RESPONDED');
    } else if (STAGE_RANK[stage] >= 0 && STAGE_RANK[stage] < STAGE_RANK.FOLLOW_UP) {
      stage = sequence === 1 ? 'CONTACTED' : 'FOLLOW_UP';
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.prospectTouch.create({
        data: {
          prospectId: id,
          userId,
          sequence,
          channel,
          approachId: dto.approachId,
          templateId: dto.templateId,
          message: dto.message,
          outcome,
          sentAt,
        },
      }),
      this.prisma.prospect.update({
        where: { id },
        data: {
          touchCount: { increment: 1 },
          lastTouchAt: sentAt,
          nextActionAt,
          stage,
          ...this.stampsFor(prospect, stage, sentAt),
        },
        include: PROSPECT_INCLUDE,
      }),
    ]);

    return updated;
  }

  async changeStage(orgId: string, id: string, dto: ChangeStageDto) {
    const prospect = await this.findOne(orgId, id);
    const now = new Date();
    const isTerminal = TERMINAL_STAGES.includes(dto.stage);
    const isLost = dto.stage === 'LOST' || dto.stage === 'DISQUALIFIED';

    if (dto.lostReasonId) {
      const reason = await this.prisma.lostReason.findFirst({
        where: { id: dto.lostReasonId, organizationId: orgId },
        select: { id: true },
      });
      if (!reason) throw new BadRequestException('Motivo de perda nao encontrado');
    }

    return this.prisma.prospect.update({
      where: { id },
      data: {
        stage: dto.stage,
        ...this.stampsFor(prospect, dto.stage, now),
        ...(isLost
          ? {
              lostAt: prospect.lostAt ?? now,
              ...(dto.lostReasonId !== undefined ? { lostReasonId: dto.lostReasonId } : {}),
              ...(dto.lostNote !== undefined ? { lostNote: dto.lostNote } : {}),
            }
          : { lostAt: null, lostReasonId: null, lostNote: null }),
        ...(dto.dealValue !== undefined ? { dealValue: dto.dealValue } : {}),
        // Etapa terminal não tem próxima ação; as demais só mudam a
        // data se o operador pediu explicitamente.
        ...(isTerminal
          ? { nextActionAt: null }
          : dto.nextActionAt !== undefined
            ? { nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : null }
            : {}),
      },
      include: PROSPECT_INCLUDE,
    });
  }

  // Prospect esquentou: vira Contact + Lead no pipeline de vendas e
  // passa a ser tratado pela máquina que já existe.
  async convert(orgId: string, userId: string, id: string, dto: ConvertProspectDto) {
    const prospect = await this.findOne(orgId, id);
    if (prospect.leadId) {
      throw new ConflictException('Prospect ja foi convertido em lead');
    }

    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: dto.pipelineId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!pipeline) throw new BadRequestException('Pipeline nao encontrado');

    let statusId = dto.statusId;
    if (statusId) {
      const status = await this.prisma.pipelineStatus.findFirst({
        where: { id: statusId, pipelineId: dto.pipelineId },
        select: { id: true },
      });
      if (!status) throw new BadRequestException('Status nao pertence a este pipeline');
    } else {
      const defaultStatus = await this.prisma.pipelineStatus.findFirst({
        where: { pipelineId: dto.pipelineId, isDefault: true },
        select: { id: true },
      });
      if (!defaultStatus) throw new BadRequestException('Pipeline nao tem status padrao');
      statusId = defaultStatus.id;
    }

    // Reaproveita contato existente pelo e-mail/telefone antes de criar
    // outro — a prospecção costuma reencontrar quem já está na base.
    let contact = prospect.contactId
      ? await this.prisma.contact.findFirst({
          where: { id: prospect.contactId, organizationId: orgId },
        })
      : null;

    if (!contact && (prospect.email || prospect.phone)) {
      contact = await this.prisma.contact.findFirst({
        where: {
          organizationId: orgId,
          deletedAt: null,
          OR: [
            ...(prospect.email ? [{ email: prospect.email }] : []),
            ...(prospect.phone ? [{ phone: prospect.phone }] : []),
          ],
        },
      });
    }

    if (!contact) {
      contact = await this.prisma.contact.create({
        data: {
          organizationId: orgId,
          name: prospect.name,
          email: prospect.email,
          phone: prospect.phone,
        },
      });
    }

    const outboundSource = await this.prisma.leadSource.findFirst({
      where: { organizationId: orgId, type: 'OUTBOUND' },
      select: { id: true },
    });

    const maxPos = await this.prisma.lead.aggregate({
      where: { statusId, deletedAt: null },
      _max: { position: true },
    });

    const lead = await this.prisma.lead.create({
      data: {
        organizationId: orgId,
        pipelineId: dto.pipelineId,
        statusId,
        title: dto.title || prospect.business || prospect.name,
        estimatedValue: dto.estimatedValue ?? prospect.dealValue ?? 0,
        assigneeId: dto.assigneeId ?? prospect.ownerId ?? undefined,
        contactId: contact.id,
        sourceId: outboundSource?.id,
        temperature: 'HOT',
        position: (maxPos._max.position ?? -1) + 1,
      },
      include: {
        status: true,
        contact: true,
        assignee: { select: { id: true, name: true, email: true } },
        source: true,
      },
    });

    const nextStage = this.maxStage(prospect.stage, 'RESPONDED');
    const updated = await this.prisma.prospect.update({
      where: { id },
      data: {
        leadId: lead.id,
        contactId: contact.id,
        stage: nextStage,
        ...this.stampsFor(prospect, nextStage, new Date()),
      },
      include: PROSPECT_INCLUDE,
    });

    await this.activities.logActivity(lead.id, userId, 'CREATED', {
      title: lead.title,
      origem: 'prospeccao-ativa',
      prospectId: prospect.id,
      toques: prospect.touchCount,
    });

    // Mesmo evento do fluxo normal: automações, notificações e CAPI
    // continuam funcionando sem saber que veio da prospecção.
    this.eventBus.emit('lead.created', { leadId: lead.id, orgId, userId });

    return { prospect: updated, lead };
  }

  // ─── Ações em massa ─────────────────────────────────────────

  async bulkAssign(orgId: string, dto: BulkProspectDto) {
    const result = await this.prisma.prospect.updateMany({
      where: { id: { in: dto.ids }, organizationId: orgId, deletedAt: null },
      data: { ownerId: dto.ownerId || null },
    });
    return { updated: result.count };
  }

  async bulkList(orgId: string, dto: BulkProspectDto) {
    const result = await this.prisma.prospect.updateMany({
      where: { id: { in: dto.ids }, organizationId: orgId, deletedAt: null },
      data: { listId: dto.listId || null },
    });
    return { updated: result.count };
  }

  async bulkStage(orgId: string, dto: BulkProspectDto) {
    if (!dto.stage) throw new BadRequestException('stage e obrigatorio');
    const stage = dto.stage;
    const prospects = await this.prisma.prospect.findMany({
      where: { id: { in: dto.ids }, organizationId: orgId, deletedAt: null },
    });
    const now = new Date();
    const isLost = stage === 'LOST' || stage === 'DISQUALIFIED';

    await this.prisma.$transaction(
      prospects.map((p) =>
        this.prisma.prospect.update({
          where: { id: p.id },
          data: {
            stage,
            ...this.stampsFor(p, stage, now),
            ...(TERMINAL_STAGES.includes(stage) ? { nextActionAt: null } : {}),
            // Tirar de LOST tem que limpar os campos de perda tambem: o
            // funil conta perda por lostAt, e um carimbo esquecido faria
            // o prospect ser contado como perdido depois de ressuscitar.
            ...(isLost
              ? { lostAt: p.lostAt ?? now }
              : { lostAt: null, lostReasonId: null, lostNote: null }),
          },
        }),
      ),
    );
    return { updated: prospects.length };
  }

  async bulkDelete(orgId: string, dto: BulkProspectDto) {
    const result = await this.prisma.prospect.updateMany({
      where: { id: { in: dto.ids }, organizationId: orgId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { deleted: result.count };
  }

  // ─── Auxiliares ─────────────────────────────────────────────

  private maxStage(a: ProspectStage, b: ProspectStage): ProspectStage {
    if (STAGE_RANK[a] < 0) return b;
    return STAGE_RANK[a] >= STAGE_RANK[b] ? a : b;
  }

  // Preenche, para trás, todo carimbo vazio até o posto alvo. É o que
  // garante que "fez reunião" implique "respondeu" e "foi abordado" —
  // sem isso o funil por coorte mentiria.
  private stampsFor(
    prospect: Record<string, unknown>,
    stage: ProspectStage,
    when: Date,
  ): Prisma.ProspectUncheckedUpdateInput {
    const target = STAGE_RANK[stage];
    if (target < 0) return {};

    const data: Record<string, Date> = {};
    for (const [s, field] of Object.entries(STAGE_STAMP)) {
      const rank = STAGE_RANK[s as ProspectStage];
      if (rank <= target && !prospect[field]) {
        data[field] = when;
      }
    }
    return data as Prisma.ProspectUncheckedUpdateInput;
  }

  // Aceita "@loja", "loja" ou a URL inteira do perfil e guarda sempre
  // o handle nu — senão o mesmo perfil entra duas vezes na lista.
  private normalizeHandle(handle?: string, profileUrl?: string): string | null {
    const raw = handle?.trim() || profileUrl?.trim();
    if (!raw) return null;

    const fromUrl = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
    if (fromUrl) return fromUrl[1].toLowerCase();

    return raw.replace(/^@/, '').replace(/\/+$/, '').toLowerCase() || null;
  }

  private profileUrlFromHandle(
    handle: string | null,
    channel?: ProspectChannel,
  ): string | null {
    if (!handle) return null;
    if (channel && channel !== 'INSTAGRAM') return null;
    return `https://www.instagram.com/${handle}/`;
  }
}
