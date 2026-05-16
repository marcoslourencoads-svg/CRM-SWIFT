import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Publisher SSE específico do inbox.
 * Agrupa conexões por organizationId (não por user) — todo mundo da org
 * vê a inbox em tempo real.
 */
@Injectable()
export class InboxPublisher {
  private readonly logger = new Logger(InboxPublisher.name);
  private readonly connections = new Map<string, Set<Response>>();

  register(orgId: string, res: Response) {
    let set = this.connections.get(orgId);
    if (!set) {
      set = new Set<Response>();
      this.connections.set(orgId, set);
    }
    set.add(res);

    res.on('close', () => {
      const current = this.connections.get(orgId);
      if (current) {
        current.delete(res);
        if (current.size === 0) {
          this.connections.delete(orgId);
        }
      }
    });
  }

  publish(orgId: string, event: string, payload: unknown) {
    const set = this.connections.get(orgId);
    if (!set || set.size === 0) return;

    const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of set) {
      try {
        res.write(data);
      } catch (err) {
        this.logger.warn(`Failed to write SSE inbox for org ${orgId}: ${err}`);
      }
    }
  }
}
