import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMetaAccountDto } from './dto/create-meta-account.dto';
import { UpdateMetaAccountDto } from './dto/update-meta-account.dto';
import { TokenCryptoService } from './services/token-crypto.service';
import {
  DatePreset,
  MetaGraphService,
} from './services/meta-graph.service';
import { ReportBuilderService } from './services/report-builder.service';
import { ReportDispatcherService } from './services/report-dispatcher.service';

const PERIOD_LABEL: Record<DatePreset, string> = {
  today: 'Hoje (parcial)',
  yesterday: 'Ontem',
  this_week_mon_today: 'Esta semana',
  last_7d: 'Últimos 7 dias',
  last_14d: 'Últimos 14 dias',
  last_30d: 'Últimos 30 dias',
};

@Injectable()
export class MetaAdsReportsService {
  private readonly logger = new Logger(MetaAdsReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: TokenCryptoService,
    private readonly graph: MetaGraphService,
    private readonly builder: ReportBuilderService,
    private readonly dispatcher: ReportDispatcherService,
  ) {}

  async create(orgId: string, dto: CreateMetaAccountDto) {
    const adAccountId = dto.adAccountId.startsWith('act_')
      ? dto.adAccountId
      : `act_${dto.adAccountId}`;

    const exists = await this.prisma.metaAdAccount.findUnique({
      where: {
        organizationId_adAccountId: {
          organizationId: orgId,
          adAccountId,
        },
      },
    });
    if (exists) {
      throw new ConflictException(
        'Esta conta de anúncios já está cadastrada na organização',
      );
    }

    return this.prisma.metaAdAccount.create({
      data: {
        organizationId: orgId,
        clientName: dto.clientName,
        adAccountId,
        accessTokenEnc: this.crypto.encrypt(dto.accessToken),
        reportChannel: dto.reportChannel,
        reportTarget: dto.reportTarget,
        scheduleCron: dto.scheduleCron ?? '0 8 * * *',
        timezone: dto.timezone ?? 'America/Sao_Paulo',
        active: dto.active ?? true,
      },
      select: this.publicSelect(),
    });
  }

  async findAll(orgId: string) {
    return this.prisma.metaAdAccount.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      select: this.publicSelect(),
    });
  }

  async findOne(orgId: string, id: string) {
    const account = await this.prisma.metaAdAccount.findFirst({
      where: { id, organizationId: orgId },
      select: this.publicSelect(),
    });
    if (!account) throw new NotFoundException('Conta Meta não encontrada');
    return account;
  }

  async update(orgId: string, id: string, dto: UpdateMetaAccountDto) {
    await this.assertExists(orgId, id);

    const data: Record<string, unknown> = {
      ...dto,
    };
    if (dto.accessToken) {
      data.accessTokenEnc = this.crypto.encrypt(dto.accessToken);
    }
    delete data.accessToken;
    if (dto.adAccountId) {
      data.adAccountId = dto.adAccountId.startsWith('act_')
        ? dto.adAccountId
        : `act_${dto.adAccountId}`;
    }

    return this.prisma.metaAdAccount.update({
      where: { id },
      data,
      select: this.publicSelect(),
    });
  }

  async remove(orgId: string, id: string) {
    await this.assertExists(orgId, id);
    await this.prisma.metaAdAccount.delete({ where: { id } });
  }

  async listReports(orgId: string, accountId: string, limit = 30) {
    await this.assertExists(orgId, accountId);
    return this.prisma.metaReport.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async generate(
    orgId: string,
    accountId: string,
    datePreset: DatePreset = 'yesterday',
    options: { send?: boolean } = {},
  ) {
    const account = await this.prisma.metaAdAccount.findFirst({
      where: { id: accountId, organizationId: orgId },
    });
    if (!account) throw new NotFoundException('Conta Meta não encontrada');

    return this.runForAccount(account, datePreset, options.send ?? true);
  }

  async runForAccount(
    account: {
      id: string;
      clientName: string;
      adAccountId: string;
      accessTokenEnc: string;
      reportChannel: any;
      reportTarget: string;
    },
    datePreset: DatePreset,
    send: boolean,
  ) {
    const periodLabel = PERIOD_LABEL[datePreset];
    let token: string;
    try {
      token = this.crypto.decrypt(account.accessTokenEnc);
    } catch {
      throw new Error('Falha ao descriptografar token. Verifique META_ADS_ENCRYPTION_KEY');
    }

    const insights = await this.graph.fetchCampaignInsights(
      account.adAccountId,
      token,
      datePreset,
    );

    const built = this.builder.build(account.clientName, periodLabel, insights);

    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 1);

    const report = await this.prisma.metaReport.create({
      data: {
        accountId: account.id,
        periodStart,
        periodEnd: now,
        rawText: built.text,
        rawData: insights as any,
        totalSpend: built.totalSpendCents,
      },
    });

    let sendResult: { ok: boolean; channel: string; error?: string } | null = null;
    if (send) {
      sendResult = await this.dispatcher.send(
        account.reportChannel,
        account.reportTarget,
        built.text,
      );
      await this.prisma.metaReport.update({
        where: { id: report.id },
        data: {
          sentAt: sendResult.ok ? new Date() : null,
          sentChannel: sendResult.ok ? sendResult.channel : null,
          sendError: sendResult.ok ? null : sendResult.error ?? 'erro',
        },
      });
    }

    await this.prisma.metaAdAccount.update({
      where: { id: account.id },
      data: {
        lastRunAt: now,
        lastError: null,
      },
    });

    return {
      reportId: report.id,
      text: built.text,
      send: sendResult,
      campaignsCount: insights.length,
      unprefixed: built.unprefixedCampaigns,
    };
  }

  async listActiveAccounts() {
    return this.prisma.metaAdAccount.findMany({
      where: { active: true },
    });
  }

  async markAccountError(accountId: string, error: string) {
    await this.prisma.metaAdAccount.update({
      where: { id: accountId },
      data: { lastError: error.slice(0, 500), lastRunAt: new Date() },
    });
  }

  private async assertExists(orgId: string, id: string) {
    const exists = await this.prisma.metaAdAccount.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Conta Meta não encontrada');
  }

  private publicSelect() {
    return {
      id: true,
      organizationId: true,
      clientName: true,
      adAccountId: true,
      reportChannel: true,
      reportTarget: true,
      scheduleCron: true,
      timezone: true,
      active: true,
      lastRunAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }
}
