/**
 * Contrato pra qualquer provider de inbox (WhatsApp, Instagram, Email, etc).
 *
 * v1: só `manual` é implementação real. Os outros (evolution, zapi, meta_cloud)
 * são esqueletos que retornam ok local mas não disparam nada externamente.
 *
 * Quando cliente quiser plugar provider real, troca a injeção e mantém a
 * mesma assinatura — sem refator no service.
 */
export interface SendMessageInput {
  conversationId: string;
  body: string;
  contactPhone?: string | null;
  channelConfig: Record<string, unknown>;
}

export interface SendMessageResult {
  externalId: string | null;
  status: 'SENT' | 'QUEUED' | 'FAILED';
  error?: string;
}

export interface IInboxProvider {
  readonly name: string;
  send(input: SendMessageInput): Promise<SendMessageResult>;
}
