import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { createHmac, randomBytes } from 'crypto';

const MAX_FAILURES = 10;

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── CRUD ──────────────────────────────────────────────

  async create(orgId: string, dto: CreateWebhookDto) {
    const secret = randomBytes(32).toString('hex');

    return this.prisma.webhook.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        url: dto.url,
        secret,
        events: dto.events,
        headers: dto.headers ?? undefined,
      },
    });
  }

  async findAll(orgId: string) {
    return this.prisma.webhook.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(orgId: string, id: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }

  async update(orgId: string, id: string, dto: UpdateWebhookDto) {
    await this.findOne(orgId, id);

    // If re-activating, reset failure count
    const extra =
      dto.isActive === true ? { failureCount: 0 } : {};

    return this.prisma.webhook.update({
      where: { id },
      data: { ...dto, ...extra },
    });
  }

  async remove(orgId: string, id: string) {
    await this.findOne(orgId, id);
    return this.prisma.webhook.delete({ where: { id } });
  }

  // ─── Event delivery ────────────────────────────────────

  async deliverEvent(orgId: string, event: string, payload: any) {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
      },
    });

    // Filter webhooks subscribed to this event
    const matching = webhooks.filter((wh: any) => {
      const events = wh.events as string[];
      return events.includes(event) || events.includes('*');
    });

    const results = await Promise.allSettled(
      matching.map((wh: any) => this.deliver(wh, event, payload)),
    );

    return results;
  }

  private async deliver(
    webhook: { id: string; url: string; secret: string; headers: any; failureCount: number },
    event: string,
    payload: any,
  ) {
    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    const signature = createHmac('sha256', webhook.secret)
      .update(body)
      .digest('hex');

    const customHeaders: Record<string, string> =
      (webhook.headers as Record<string, string>) ?? {};

    const start = Date.now();
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let success = false;

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
          ...customHeaders,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      responseStatus = res.status;
      responseBody = await res.text().catch(() => null);
      success = res.ok;
    } catch (err: any) {
      responseBody = err.message ?? 'Request failed';
      this.logger.warn(`Webhook ${webhook.id} delivery failed: ${err.message}`);
    }

    const executionTimeMs = Date.now() - start;

    // Log
    await this.prisma.webhookLog.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: { event, payload },
        responseStatus,
        responseBody,
        success,
        executionTimeMs,
      },
    });

    // Update webhook state
    if (success) {
      await this.prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          lastTriggeredAt: new Date(),
          failureCount: 0,
        },
      });
    } else {
      const newCount = webhook.failureCount + 1;
      await this.prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          lastTriggeredAt: new Date(),
          failureCount: newCount,
          ...(newCount >= MAX_FAILURES ? { isActive: false } : {}),
        },
      });

      if (newCount >= MAX_FAILURES) {
        this.logger.warn(
          `Webhook ${webhook.id} auto-disabled after ${MAX_FAILURES} consecutive failures`,
        );
      }
    }
  }

  // ─── Test ping ─────────────────────────────────────────

  async testWebhook(orgId: string, webhookId: string) {
    const webhook = await this.findOne(orgId, webhookId);
    await this.deliver(
      webhook,
      'webhook.test',
      { message: 'Test ping from CRM', webhookId },
    );
    return { message: 'Test event sent' };
  }

  // ─── Logs ──────────────────────────────────────────────

  async getLogsForWebhook(webhookId: string, limit = 20) {
    return this.prisma.webhookLog.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
