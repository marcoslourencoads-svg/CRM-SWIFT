import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Publisher in-memory de Server-Sent Events.
 *
 * Mantém um Map<userId, Set<Response>> de conexões ativas.
 * Quando `publish(userId, payload)` é chamado, escreve um evento SSE em todas
 * as Response abertas daquele user.
 *
 * Limitação documentada (ADR-005 do plano): single-instance. Quando escalarmos
 * pra multi-instance no Render, migrar pra Redis pub/sub (Upstash já configurado).
 */
@Injectable()
export class NotificationsPublisher {
  private readonly logger = new Logger(NotificationsPublisher.name);
  private readonly connections = new Map<string, Set<Response>>();

  register(userId: string, res: Response) {
    let set = this.connections.get(userId);
    if (!set) {
      set = new Set<Response>();
      this.connections.set(userId, set);
    }
    set.add(res);

    res.on('close', () => {
      const current = this.connections.get(userId);
      if (current) {
        current.delete(res);
        if (current.size === 0) {
          this.connections.delete(userId);
        }
      }
    });
  }

  publish(userId: string, event: string, payload: unknown) {
    const set = this.connections.get(userId);
    if (!set || set.size === 0) return;

    const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of set) {
      try {
        res.write(data);
      } catch (err) {
        this.logger.warn(`Failed to write SSE for ${userId}: ${err}`);
      }
    }
  }

  /** Quantos clientes conectados de um user. */
  countFor(userId: string): number {
    return this.connections.get(userId)?.size ?? 0;
  }

  /** Total de conexões ativas. */
  totalConnections(): number {
    let total = 0;
    for (const set of this.connections.values()) total += set.size;
    return total;
  }
}
