import { Injectable, Logger } from '@nestjs/common';
import type {
  IInboxProvider,
  SendMessageInput,
  SendMessageResult,
} from './provider.interface';

/**
 * Esqueleto pro Z-API (gateway BR).
 * v1: retorna FAILED — implementação real quando cliente assinar plano com Z-API.
 */
@Injectable()
export class ZapiProvider implements IInboxProvider {
  readonly name = 'zapi';
  private readonly logger = new Logger(ZapiProvider.name);

  async send(_input: SendMessageInput): Promise<SendMessageResult> {
    this.logger.warn('[zapi] provider não implementado v1 — usar manual');
    return {
      externalId: null,
      status: 'FAILED',
      error: 'Z-API provider não está disponível ainda',
    };
  }
}
