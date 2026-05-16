import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IsEnum, IsOptional, IsString, IsArray, IsNotEmpty } from 'class-validator';
import { TeamChannelType } from '@prisma/client';
import { TeamChatService } from './team-chat.service';
import { TeamChatPublisher } from './team-chat.publisher';
import { CurrentOrg, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

class CreateChannelDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(TeamChannelType)
  @IsOptional()
  type?: TeamChannelType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsOptional()
  memberIds?: string[];
}

class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  body!: string;
}

@Controller('team-chat')
export class TeamChatController {
  constructor(
    private readonly service: TeamChatService,
    private readonly publisher: TeamChatPublisher,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ---------- Channels ----------

  @Get('channels')
  listChannels(
    @CurrentOrg() orgId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.listMyChannels(orgId, userId);
  }

  @Get('channels/:id')
  getChannel(
    @CurrentOrg() orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.service.getChannel(orgId, userId, id);
  }

  @Post('channels')
  createChannel(
    @CurrentOrg() orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateChannelDto,
  ) {
    return this.service.createChannel(orgId, userId, dto);
  }

  @Post('channels/:id/members/:userId')
  addMember(
    @CurrentOrg() orgId: string,
    @CurrentUser('sub') requesterId: string,
    @Param('id') channelId: string,
    @Param('userId') userId: string,
  ) {
    return this.service.addMember(orgId, requesterId, channelId, userId);
  }

  // ---------- Messages ----------

  @Get('channels/:id/messages')
  listMessages(
    @CurrentOrg() orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') channelId: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listMessages(
      orgId,
      userId,
      channelId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post('channels/:id/messages')
  sendMessage(
    @CurrentOrg() orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') channelId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.sendMessage(orgId, userId, channelId, dto.body);
  }

  @Post('channels/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @CurrentOrg() orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') channelId: string,
  ) {
    return this.service.markAsRead(orgId, userId, channelId);
  }

  // ---------- SSE Stream ----------

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
    res.setHeader('X-Accel-Buffering', 'no');
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
}
