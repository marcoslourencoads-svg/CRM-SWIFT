import { Injectable, Logger } from '@nestjs/common';
import type {
  IInboxProvider,
  SendMessageInput,
  SendMessageResult,
} from './provider.interface';

/**
 * Esqueleto pro Evolution API (self-host).
 * v1: retorna FAILED — cliente precisa configurar provider real depois.
 */
@Injectable()
export class EvolutionProvider implements IInboxProvider {
  readonly name = 'evolution';
  private readonly logger = new Logger(EvolutionProvider.name);

  async send(_input: SendMessageInput): Promise<SendMessageResult> {
    this.logger.warn('[evolution] provider não implementado v1 — usar manual');
    return {
      externalId: null,
      status: 'FAILED',
      error: 'Evolution provider não está disponível ainda',
    };
  }
}
