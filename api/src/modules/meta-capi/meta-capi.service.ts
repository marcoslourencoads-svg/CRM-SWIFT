import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * API de Conversões da Meta — integração de CRM.
 *
 * Regras fixas exigidas pela Meta para eventos vindos de CRM:
 *   action_source                 = "system_generated"  (sempre)
 *   custom_data.event_source      = "crm"               (sempre)
 *   custom_data.lead_event_source = nome do CRM
 *
 * Prioridade de correspondência (do mais forte pro mais fraco):
 *   lead_id (leadgen_id da Meta) > fbc (click id) > email > telefone > demais
 */

export type MetaEventName = 'Lead' | 'Schedule' | 'Purchase';

/** Janela em que a Meta ainda aceita o evento para otimização. */
const MAX_EVENT_AGE_DAYS = 7;

/**
 * Chaves com as quais a Meta consegue de fato achar a pessoa.
 *
 * external_id, fn e ln ficam de fora de propósito: o external_id é um id do
 * nosso banco, que a Meta nunca viu, e nome sozinho não identifica ninguém.
 * Eles enriquecem a correspondência, mas não sustentam ela sozinhos.
 */
const CHAVES_DE_CORRESPONDENCIA = ['lead_id', 'fbc', 'fbp', 'em', 'ph'];

@Injectable()
export class MetaCapiService {
  private readonly logger = new Logger(MetaCapiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─── Configuração ──────────────────────────────────────────

  get enabled(): boolean {
    return (
      this.config.get<boolean>('META_CAPI_ENABLED') === true &&
      !!this.config.get<string>('META_CAPI_DATASET_ID') &&
      !!this.config.get<string>('META_CAPI_ACCESS_TOKEN')
    );
  }

  private get datasetId(): string {
    return this.config.get<string>('META_CAPI_DATASET_ID')!;
  }

  private endpoint(): string {
    const version = this.config.get<string>('META_CAPI_API_VERSION') ?? 'v26.0';
    return `https://graph.facebook.com/${version}/${this.datasetId}/events`;
  }

  // ─── Normalização e hash ───────────────────────────────────

  /** SHA-256 do valor normalizado. Retorna undefined se não houver o que hashear. */
  private hash(value?: string | null): string | undefined {
    if (!value) return undefined;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Telefone no formato que a Meta espera: só dígitos, com código do país.
   * Números brasileiros salvos sem o 55 recebem o prefixo.
   */
  private normalizePhone(phone?: string | null): string | undefined {
    if (!phone) return undefined;
    let digits = phone.replace(/\D/g, '');
    if (!digits) return undefined;
    // 10 dígitos = DDD + 8 (fixo), 11 = DDD + 9 (celular) → falta o país
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
    return digits;
  }

  /** Separa "Maria Silva Souza" em primeiro e último nome. */
  private splitName(name?: string | null): { fn?: string; ln?: string } {
    if (!name) return {};
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return {};
    if (parts.length === 1) return { fn: parts[0] };
    return { fn: parts[0], ln: parts[parts.length - 1] };
  }

  /**
   * O click id da Meta tem o formato fb.1.<timestamp_ms>.<fbclid>.
   * Se o formulário já mandou o cookie _fbc pronto, usamos ele.
   * Caso contrário reconstruímos a partir do fbclid + hora do clique.
   */
  private buildFbc(tracking: {
    fbc?: string | null;
    fbclid?: string | null;
    clickedAt?: Date | null;
    createdAt?: Date | null;
  }): string | undefined {
    if (tracking.fbc) return tracking.fbc;
    if (!tracking.fbclid) return undefined;
    const at = tracking.clickedAt ?? tracking.createdAt ?? new Date();
    return `fb.1.${at.getTime()}.${tracking.fbclid}`;
  }

  // ─── Mapa de estágio → evento ──────────────────────────────

  /**
   * Traduz as flags da coluna do funil para o evento da Meta.
   * As flags já existem no PipelineStatus, então o funil se mapeia sozinho.
   * A ordem importa: um status pode ter mais de uma flag ligada.
   */
  resolveEventName(status: {
    isWon: boolean;
    isFinal: boolean;
    isMeeting: boolean;
    isMql: boolean;
  }): MetaEventName | null {
    if (status.isWon) return 'Purchase';
    if (status.isMeeting) return 'Schedule';
    if (status.isMql) return 'Lead';
    return null;
  }

  // ─── Montagem da carga ─────────────────────────────────────

  private buildUserData(lead: any): Record<string, unknown> {
    const tracking = lead.tracking ?? {};
    const contact = lead.contact ?? {};
    const { fn, ln } = this.splitName(contact.name);

    const userData: Record<string, unknown> = {};

    // Prioridade mais alta: o lead_id gerado pela Meta (15–17 dígitos).
    // Vai como número e NÃO é hasheado.
    if (tracking.metaLeadId && /^\d{15,17}$/.test(tracking.metaLeadId)) {
      userData.lead_id = Number(tracking.metaLeadId);
    }

    const fbc = this.buildFbc(tracking);
    if (fbc) userData.fbc = fbc;
    if (tracking.fbp) userData.fbp = tracking.fbp;

    const em = this.hash(contact.email);
    if (em) userData.em = [em];

    const ph = this.hash(this.normalizePhone(contact.phone));
    if (ph) userData.ph = [ph];

    const fnHash = this.hash(fn);
    if (fnHash) userData.fn = [fnHash];

    const lnHash = this.hash(ln);
    if (lnHash) userData.ln = [lnHash];

    // Ajuda a Meta a costurar os vários eventos do mesmo lead.
    const externalId = this.hash(contact.id ?? lead.id);
    if (externalId) userData.external_id = [externalId];

    if (tracking.ip) userData.client_ip_address = tracking.ip;
    if (tracking.userAgent) userData.client_user_agent = tracking.userAgent;

    return userData;
  }

  /**
   * Quais chaves com poder de correspondência a carga levou.
   *
   * Se isto vier vazio, a Meta não tem como casar o evento com ninguém e o
   * envio é abortado — mandar assim só sujaria o diagnóstico da conta.
   */
  private matchKeysOf(userData: Record<string, unknown>): string[] {
    return CHAVES_DE_CORRESPONDENCIA.filter((k) => userData[k] !== undefined);
  }

  private buildPayload(
    lead: any,
    eventName: MetaEventName,
    eventTime: Date,
    eventId: string,
  ) {
    const userData = this.buildUserData(lead);

    const customData: Record<string, unknown> = {
      // Os dois campos abaixo são obrigatórios para integração de CRM.
      event_source: 'crm',
      lead_event_source:
        this.config.get<string>('META_CAPI_LEAD_EVENT_SOURCE') ?? 'CRM SWIFT',
    };

    // estimatedValue é armazenado em centavos no CRM.
    if (eventName === 'Purchase') {
      customData.value = Number((lead.estimatedValue / 100).toFixed(2));
      customData.currency = 'BRL';
    }

    return {
      event_name: eventName,
      event_time: Math.floor(eventTime.getTime() / 1000),
      event_id: eventId,
      action_source: 'system_generated',
      user_data: userData,
      custom_data: customData,
    };
  }

  // ─── Envio ─────────────────────────────────────────────────

  /**
   * Envia o evento correspondente ao estágio do lead.
   *
   * A deduplicação é feita pela unique [leadId, eventName]: se a linha já
   * existe, o evento já foi disparado e nada é reenviado. É isso que impede
   * um replay de inflar a conversão dentro da Meta.
   */
  async sendForLead(
    orgId: string,
    leadId: string,
    eventName: MetaEventName,
    opts: { eventTime?: Date; force?: boolean } = {},
  ) {
    if (!this.enabled) {
      this.logger.debug(
        `CAPI desligado — evento ${eventName} do lead ${leadId} ignorado`,
      );
      return { skipped: true, reason: 'disabled' as const };
    }

    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
      include: { tracking: true, contact: true, status: true },
    });

    if (!lead) throw new BadRequestException('Lead não encontrado');

    const eventTime = opts.eventTime ?? new Date();
    const eventId = randomUUID();

    // Reserva o slot antes de enviar. Se já existe, para aqui.
    let record;
    try {
      record = await this.prisma.metaCapiEvent.create({
        data: {
          organizationId: orgId,
          leadId,
          eventName,
          eventId,
          eventTime,
          datasetId: this.datasetId,
          status: 'PENDING',
        },
      });
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err;
      if (!opts.force) {
        this.logger.log(
          `Evento ${eventName} do lead ${leadId} já enviado — ignorando`,
        );
        return { skipped: true, reason: 'duplicate' as const };
      }
      record = await this.prisma.metaCapiEvent.update({
        where: { leadId_eventName: { leadId, eventName } },
        data: { eventId, eventTime, status: 'PENDING' },
      });
    }

    const event = this.buildPayload(lead, eventName, eventTime, record.eventId);
    const matchKeys = this.matchKeysOf(event.user_data);

    // Sem nenhuma chave de correspondência a Meta não consegue casar o evento.
    if (matchKeys.length === 0) {
      await this.prisma.metaCapiEvent.update({
        where: { id: record.id },
        data: {
          status: 'SKIPPED',
          matchKeys,
          responseBody:
            'Nenhuma chave de correspondência disponível (sem lead_id, fbc, email ou telefone)',
        },
      });
      this.logger.warn(
        `Lead ${leadId} sem chave de correspondência — ${eventName} não enviado`,
      );
      return { skipped: true, reason: 'no_match_keys' as const };
    }

    const ageDays = (Date.now() - eventTime.getTime()) / 86_400_000;
    if (ageDays > MAX_EVENT_AGE_DAYS) {
      this.logger.warn(
        `Evento ${eventName} do lead ${leadId} tem ${ageDays.toFixed(1)} dias — ` +
          `acima da janela de ${MAX_EVENT_AGE_DAYS} dias, a Meta pode recusar`,
      );
    }

    const body: Record<string, unknown> = { data: [event] };
    const testCode = this.config.get<string>('META_CAPI_TEST_EVENT_CODE');
    if (testCode) body.test_event_code = testCode;

    const started = Date.now();
    try {
      const token = this.config.get<string>('META_CAPI_ACCESS_TOKEN')!;
      const res = await fetch(
        `${this.endpoint()}?access_token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10_000),
        },
      );

      const text = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* resposta não-JSON entra crua no log */
      }

      const ok = res.ok && !parsed?.error;

      await this.prisma.metaCapiEvent.update({
        where: { id: record.id },
        data: {
          status: ok ? 'SENT' : 'FAILED',
          // O token nunca é persistido — só a carga.
          payload: body as any,
          matchKeys,
          responseBody: text.slice(0, 2000),
          fbTraceId: parsed?.fbtrace_id ?? parsed?.error?.fbtrace_id ?? null,
          attempts: { increment: 1 },
          sentAt: ok ? new Date() : null,
        },
      });

      if (ok) {
        this.logger.log(
          `${eventName} enviado (lead ${leadId}, chaves: ${matchKeys.join(', ')}, ${Date.now() - started}ms)`,
        );
      } else {
        this.logger.error(
          `Falha no ${eventName} do lead ${leadId}: ${text.slice(0, 300)}`,
        );
      }

      return { ok, eventId: record.eventId, matchKeys, response: parsed ?? text };
    } catch (err: any) {
      await this.prisma.metaCapiEvent.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          payload: body as any,
          matchKeys,
          responseBody: String(err?.message ?? err).slice(0, 2000),
          attempts: { increment: 1 },
        },
      });
      this.logger.error(
        `Erro de rede no ${eventName} do lead ${leadId}: ${err?.message}`,
      );
      return { ok: false, error: String(err?.message ?? err) };
    }
  }

  // ─── Consulta ──────────────────────────────────────────────

  async listForLead(orgId: string, leadId: string) {
    return this.prisma.metaCapiEvent.findMany({
      where: { organizationId: orgId, leadId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listRecent(orgId: string, status?: string, limit = 50) {
    return this.prisma.metaCapiEvent.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  /** Resumo por evento e status — alimenta o diagnóstico da integração. */
  async stats(orgId: string) {
    const grouped = await this.prisma.metaCapiEvent.groupBy({
      by: ['eventName', 'status'],
      where: { organizationId: orgId },
      _count: { _all: true },
    });

    return {
      enabled: this.enabled,
      datasetId: this.enabled ? this.datasetId : null,
      testMode: !!this.config.get<string>('META_CAPI_TEST_EVENT_CODE'),
      breakdown: grouped.map((g) => ({
        eventName: g.eventName,
        status: g.status,
        count: g._count._all,
      })),
    };
  }
}
