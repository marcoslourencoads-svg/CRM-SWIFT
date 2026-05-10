import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsPublisher } from './notifications.publisher';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly publisher: NotificationsPublisher,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * SSE stream. EventSource não suporta headers customizados, então o token
   * vai via query param `?token=`. Validado manualmente; rota é Public pra
   * bypassar o JwtAuthGuard.
   *
   * Mantém Content-Type: text/event-stream e Cache-Control: no-cache.
   * Envia heartbeat a cada 25s pra evitar timeout em proxies.
   */
  @Public()
  @Get('stream')
  async stream(
    @Query('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!token) throw new UnauthorizedException('Missing token');

    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);
    this.publisher.register(payload.sub, res);

    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 25000);

    req.on('close', () => clearInterval(heartbeat));
  }

  @Get()
  findAll(
    @CurrentUser('sub') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findByUser(
      userId,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('sub') userId: string) {
    return this.service.unreadCount(userId);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.service.markRead(userId, id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser('sub') userId: string) {
    return this.service.markAllRead(userId);
  }

  @Get('preferences')
  getPreferences(@CurrentUser('sub') userId: string) {
    return this.service.getPreferences(userId);
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdatePreferenceDto,
  ) {
    return this.service.updatePreferences(
      userId,
      dto.eventType as any,
      dto.inApp,
      dto.email,
    );
  }
}
