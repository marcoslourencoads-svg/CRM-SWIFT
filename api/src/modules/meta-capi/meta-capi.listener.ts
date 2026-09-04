import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaCapiService } from './meta-capi.service';

/**
 * Liga o barramento de eventos do CRM à API de Conversões.
 *
 * A Meta exige um gatilho por estágio do funil, incluindo o estágio inicial.
 * Como o PipelineStatus já carrega as flags isMql / isMeeting / isWon, o
 * mapeamento sai direto da configuração do funil — sem regra hardcoded.
 *
 * Nada aqui bloqueia a request do usuário: todo envio é best-effort e
 * qualquer erro fica no log e na tabela meta_capi_events.
 */
@Injectable()
export class MetaCapiListener {
  private readonly logger = new Logger(MetaCapiListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly capi: MetaCapiService,
  ) {}

  @OnEvent('lead.status_changed')
  handleStatusChanged(payload: {
    leadId: string;
    fromStatusId: string;
    toStatusId: string;
    orgId: string;
  }) {
    return this.dispatch(payload.orgId, payload.leadId, payload.toStatusId).catch(
      (err) =>
        this.logger.error(
          `Falha ao despachar CAPI em lead.status_changed: ${err.message}`,
        ),
    );
  }

  @OnEvent('lead.created')
  handleLeadCreated(payload: { leadId: string; orgId: string }) {
    return this.dispatchFromLead(payload.orgId, payload.leadId).catch((err) =>
      this.logger.error(
        `Falha ao despachar CAPI em lead.created: ${err.message}`,
      ),
    );
  }

  // ─── Internos ──────────────────────────────────────────────

  private async dispatchFromLead(orgId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId },
      select: { statusId: true },
    });
    if (!lead) return;
    return this.dispatch(orgId, leadId, lead.statusId);
  }

  private async dispatch(orgId: string, leadId: string, statusId: string) {
    if (!this.capi.enabled) return;

    const status = await this.prisma.pipelineStatus.findUnique({
      where: { id: statusId },
      select: { isWon: true, isFinal: true, isMeeting: true, isMql: true },
    });
    if (!status) return;

    const eventName = this.capi.resolveEventName(status);
    if (!eventName) {
      // Coluna sem flag de funil não vira evento — é estágio interno.
      return;
    }

    await this.capi.sendForLead(orgId, leadId, eventName);
  }
}
