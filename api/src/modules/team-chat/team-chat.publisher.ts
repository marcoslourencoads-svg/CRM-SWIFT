import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Publisher SSE pro chat interno. Conexões agrupadas por userId,
 * já que cada user só vê os canais que é membro.
 */
@Injectable()
export class TeamChatPublisher {
  private readonly logger = new Logger(TeamChatPublisher.name);
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
        if (current.size === 0) this.connections.delete(userId);
      }
    });
  }

  publishToUsers(userIds: string[], event: string, payload: unknown) {
    const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const userId of userIds) {
      const set = this.connections.get(userId);
      if (!set) continue;
      for (const res of set) {
        try {
          res.write(data);
        } catch (err) {
          this.logger.warn(`SSE write failed for ${userId}: ${err}`);
        }
      }
    }
  }
}
