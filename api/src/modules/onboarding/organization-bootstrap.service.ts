import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Onboarding zero-config: quando uma org nova é criada, popula tudo
 * que faz o CRM ser utilizável em 60s pro nicho delivery/foodservice.
 *
 * Idempotente: pode ser chamado várias vezes sem duplicar.
 * Cada bloco verifica se já existe antes de criar.
 *
 * Inclui:
 * - Pipeline "Vendas" com 6 statuses (Novo → Cliente fechado + Perdido)
 * - 7 tags pré-prontas
 * - 6 lead sources
 * - 3 custom fields (faturamento, Instagram, decisor)
 * - 5 motivos de perda
 * - 3 templates WhatsApp
 * - 1 canal WhatsApp manual
 */
@Injectable()
export class OrganizationBootstrapService {
  private readonly logger = new Logger(OrganizationBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Roda o bootstrap completo. Cada bloco é idempotente.
   * Pode ser chamado dentro de uma transaction (passa o tx) ou sem.
   */
  async bootstrap(
    orgId: string,
    tx: Prisma.TransactionClient = this.prisma as never,
    ownerId?: string,
  ) {
    this.logger.log(`Bootstrapping org ${orgId}`);

    const pipeline = await this.ensurePipeline(orgId, tx);
    await this.ensureStatuses(pipeline.id, tx);
    await this.ensureCustomFields(pipeline.id, tx);
    await this.ensureTags(orgId, tx);
    await this.ensureLeadSources(orgId, tx);
    await this.ensureLostReasons(orgId, tx);
    await this.ensureWhatsappTemplates(orgId, tx);
    await this.ensureDefaultChannel(orgId, tx);
    if (ownerId) {
      await this.ensureTeamChatGeneral(orgId, ownerId, tx);
    }

    this.logger.log(`Bootstrap completo pra org ${orgId}`);
    return { pipelineId: pipeline.id };
  }

  // ---------- Pipeline ----------

  private async ensurePipeline(orgId: string, tx: Prisma.TransactionClient) {
    const existing = await tx.pipeline.findFirst({
      where: { organizationId: orgId, deletedAt: null },
    });
    if (existing) return existing;

    return tx.pipeline.create({
      data: {
        organizationId: orgId,
        name: 'Vendas',
        description: 'Pipeline padrão pro nicho delivery/foodservice',
        currency: 'BRL',
      },
    });
  }

  private async ensureStatuses(pipelineId: string, tx: Prisma.TransactionClient) {
    const existing = await tx.pipelineStatus.findMany({ where: { pipelineId } });
    if (existing.length > 0) return existing;

    const defs: Array<{
      name: string;
      color: string;
      position: number;
      isDefault?: boolean;
      isFinal?: boolean;
      isWon?: boolean;
      isMql?: boolean;
      isMeeting?: boolean;
      staleAfterDays?: number;
    }> = [
      { name: 'Novo', color: '#3B82F6', position: 0, isDefault: true, staleAfterDays: 2 },
      { name: 'Em contato', color: '#F59E0B', position: 1, isMql: true, staleAfterDays: 3 },
      { name: 'Reunião agendada', color: '#F97316', position: 2, isMeeting: true, staleAfterDays: 5 },
      { name: 'Proposta enviada', color: '#A855F7', position: 3, staleAfterDays: 7 },
      { name: 'Cliente fechado', color: '#10B981', position: 4, isFinal: true, isWon: true },
      { name: 'Perdido', color: '#EF4444', position: 5, isFinal: true },
    ];

    for (const d of defs) {
      await tx.pipelineStatus.create({ data: { pipelineId, ...d } });
    }
  }

  // ---------- Custom Fields ----------

  private async ensureCustomFields(pipelineId: string, tx: Prisma.TransactionClient) {
    const existing = await tx.customFieldDefinition.findMany({ where: { pipelineId } });
    if (existing.length > 0) return;

    const defs = [
      {
        name: 'Faturamento mensal',
        slug: 'faturamento-mensal',
        type: 'CURRENCY' as const,
        isVisibleOnCard: true,
        position: 0,
      },
      {
        name: 'Instagram',
        slug: 'instagram',
        type: 'TEXT' as const,
        isVisibleOnCard: false,
        position: 1,
      },
      {
        name: 'É o decisor?',
        slug: 'eh-decisor',
        type: 'CHECKBOX' as const,
        isVisibleOnCard: false,
        position: 2,
      },
    ];

    for (const d of defs) {
      await tx.customFieldDefinition.create({ data: { pipelineId, ...d } });
    }
  }

  // ---------- Tags ----------

  private async ensureTags(orgId: string, tx: Prisma.TransactionClient) {
    const defs = [
      { name: 'Hot', color: '#EF4444' },
      { name: 'Warm', color: '#F97316' },
      { name: 'Cold', color: '#3B82F6' },
      { name: 'Site', color: '#6B7280' },
      { name: 'Meta Ads', color: '#1877F2' },
      { name: 'Indicação', color: '#10B981' },
      { name: 'Recompra', color: '#059669' },
    ];

    for (const d of defs) {
      await tx.tag.upsert({
        where: { organizationId_name: { organizationId: orgId, name: d.name } },
        update: {},
        create: { organizationId: orgId, name: d.name, color: d.color },
      });
    }
  }

  // ---------- Lead Sources ----------

  private async ensureLeadSources(orgId: string, tx: Prisma.TransactionClient) {
    const existing = await tx.leadSource.findFirst({ where: { organizationId: orgId } });
    if (existing) return;

    const defs: Array<{ name: string; type: 'ORGANIC' | 'PAID' | 'REFERRAL' | 'DIRECT' | 'OUTBOUND' | 'OTHER'; color: string }> = [
      { name: 'Site', type: 'ORGANIC', color: '#6B7280' },
      { name: 'Meta Ads', type: 'PAID', color: '#1877F2' },
      { name: 'Google Ads', type: 'PAID', color: '#4285F4' },
      { name: 'Indicação', type: 'REFERRAL', color: '#10B981' },
      { name: 'WhatsApp', type: 'DIRECT', color: '#25D366' },
      { name: 'Manual', type: 'OTHER', color: '#94A3B8' },
    ];

    for (const d of defs) {
      await tx.leadSource.create({ data: { organizationId: orgId, ...d } });
    }
  }

  // ---------- Lost Reasons ----------

  private async ensureLostReasons(orgId: string, tx: Prisma.TransactionClient) {
    const existing = await tx.lostReason.findFirst({ where: { organizationId: orgId } });
    if (existing) return;

    const defs = [
      'Preço alto',
      'Sem orçamento agora',
      'Já fechou com concorrente',
      'Não atendeu / sumiu',
      'Não é o decisor',
    ];

    for (let i = 0; i < defs.length; i++) {
      await tx.lostReason.create({
        data: { organizationId: orgId, name: defs[i], position: i },
      });
    }
  }

  // ---------- WhatsApp Templates ----------

  private async ensureWhatsappTemplates(orgId: string, tx: Prisma.TransactionClient) {
    const existing = await tx.whatsappTemplate.findFirst({
      where: { organizationId: orgId },
    });
    if (existing) return;

    const defs = [
      {
        name: 'Boas-vindas',
        content:
          'Oi {{nome}}, tudo bem? Aqui é da Agência Swift. Vi que você se interessou pela nossa solução pra delivery. Posso te explicar como funciona?',
      },
      {
        name: 'Follow-up (2 dias)',
        content:
          'Oi {{nome}}, e aí? Conseguiu pensar sobre a proposta? Tô à disposição pra tirar qualquer dúvida.',
      },
      {
        name: 'Recuperação (7 dias)',
        content:
          '{{nome}}, sumiu! Tudo certo aí? Vi que ficou pendente nosso papo — quer marcar 15min pra fechar?',
      },
    ];

    for (const d of defs) {
      await tx.whatsappTemplate.create({ data: { organizationId: orgId, ...d } });
    }
  }

  // ---------- Channel (manual) ----------

  private async ensureDefaultChannel(orgId: string, tx: Prisma.TransactionClient) {
    const existing = await tx.channel.findFirst({
      where: { organizationId: orgId, type: 'WHATSAPP' },
    });
    if (existing) return;

    await tx.channel.create({
      data: {
        organizationId: orgId,
        type: 'WHATSAPP',
        provider: 'MANUAL',
        name: 'WhatsApp (manual)',
        isActive: true,
      },
    });
  }

  // ---------- Team chat #geral ----------

  private async ensureTeamChatGeneral(
    orgId: string,
    ownerId: string,
    tx: Prisma.TransactionClient,
  ) {
    const existing = await tx.teamChannel.findFirst({
      where: { organizationId: orgId, name: 'geral', type: 'PUBLIC' },
    });
    if (existing) return;

    await tx.teamChannel.create({
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
