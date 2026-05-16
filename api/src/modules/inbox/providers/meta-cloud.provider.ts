import { Injectable, Logger } from '@nestjs/common';
import type {
  IInboxProvider,
  SendMessageInput,
  SendMessageResult,
} from './provider.interface';

/**
 * Esqueleto pro Meta Cloud API (oficial WhatsApp Business).
 * v1: retorna FAILED — recomendado pra alta escala, custa mais.
 */
@Injectable()
export class MetaCloudProvider implements IInboxProvider {
  readonly name = 'meta_cloud';
  private readonly logger = new Logger(MetaCloudProvider.name);

  async send(_input: SendMessageInput): Promise<SendMessageResult> {
    this.logger.warn('[meta_cloud] provider não implementado v1 — usar manual');
    return {
      externalId: null,
      status: 'FAILED',
      error: 'Meta Cloud provider não está disponível ainda',
    };
  }
}
