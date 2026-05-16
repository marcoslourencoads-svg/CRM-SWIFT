import { Injectable, Logger } from '@nestjs/common';
import type {
  IInboxProvider,
  SendMessageInput,
  SendMessageResult,
} from './provider.interface';

/**
 * Provider manual: registra a mensagem localmente e retorna SENT.
 * Não dispara nada externamente — usuário copia/cola o texto no WhatsApp Web.
 *
 * Útil enquanto cliente não justifica custo de Evolution/Z-API/Meta Cloud.
 */
@Injectable()
export class ManualProvider implements IInboxProvider {
  readonly name = 'manual';
  private readonly logger = new Logger(ManualProvider.name);

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    this.logger.debug(
      `[manual] registrando outbound conv=${input.conversationId} phone=${input.contactPhone ?? '-'}`,
    );
    return {
      externalId: null,
      status: 'SENT',
    };
  }
}
