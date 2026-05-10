import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetaReportChannel } from '@prisma/client';
import axios from 'axios';

export interface DispatchResult {
  channel: string;
  ok: boolean;
  error?: string;
}

@Injectable()
export class ReportDispatcherService {
  private readonly logger = new Logger(ReportDispatcherService.name);

  constructor(private readonly config: ConfigService) {}

  async send(
    channel: MetaReportChannel,
    target: string,
    text: string,
  ): Promise<DispatchResult> {
    if (channel === 'MANUAL') {
      return { channel: 'manual', ok: true };
    }
    if (channel === 'TELEGRAM') {
      return this.sendTelegram(target, text);
    }
    return {
      channel,
      ok: false,
      error: `Canal ${channel} ainda não implementado (Fase 2)`,
    };
  }

  private async sendTelegram(
    chatId: string,
    text: string,
  ): Promise<DispatchResult> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      return {
        channel: 'telegram',
        ok: false,
        error: 'TELEGRAM_BOT_TOKEN não configurado',
      };
    }
    try {
      await axios.post(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        },
        { timeout: 15_000 },
      );
      return { channel: 'telegram', ok: true };
    } catch (err: any) {
      const msg =
        err.response?.data?.description ?? err.message ?? 'Falha desconhecida';
      this.logger.warn(`Telegram dispatch failed for ${chatId}: ${msg}`);
      return { channel: 'telegram', ok: false, error: msg };
    }
  }
}
