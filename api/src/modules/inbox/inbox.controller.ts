import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';
import {
  ChannelProvider,
  ChannelType,
  ConversationStatus,
} from '@prisma/client';
import { InboxService } from './inbox.service';
import { InboxPublisher } from './inbox.publisher';
import { CurrentOrg, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

class CreateChannelDto {
  @IsEnum(ChannelType)
  type!: ChannelType;

  @IsEnum(ChannelProvider)
  @IsOptional()
  provider?: ChannelProvider;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}

class UpdateChannelDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(ChannelProvider)
  @IsOptional()
  provider?: ChannelProvider;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

class SendOutboundDto {
  @IsString()
  @IsOptional()
  channelId?: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsString()
  @IsOptional()
  leadId?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  contactName?: string;
}

class UpdateConversationDto {
  @IsEnum(ConversationStatus)
  @IsOptional()
  status?: ConversationStatus;

  @IsString()
  @IsOptional()
  assignedTo?: string | null;

  @IsString()
  @IsOptional()
  leadId?: string | null;
}

@Controller('inbox')
export class InboxController {
  constructor(
    private readonly service: InboxService,
    private readonly publisher: InboxPublisher,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ---------- Channels ----------

  @Get('channels')
  listChannels(@CurrentOrg() orgId: string) {
    return this.service.listChannels(orgId);
  }

  @Post('channels')
  createChannel(@CurrentOrg() orgId: string, @Body() dto: CreateChannelDto) {
    return this.service.createChannel(orgId, dto);
  }

  @Patch('channels/:id')
  updateChannel(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.service.updateChannel(orgId, id, dto);
  }

  @Delete('channels/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeChannel(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.removeChannel(orgId, id);
  }

  // ---------- Conversations ----------

  @Get('conversations')
  listConversations(
    @CurrentOrg() orgId: string,
    @Query('status') status?: ConversationStatus,
    @Query('channelId') channelId?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listConversations(orgId, {
      status,
      channelId,
      assignedTo,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('conversations/:id')
  getConversation(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.getConversation(orgId, id);
  }

  @Patch('conversations/:id')
  updateConversation(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.service.updateConversation(orgId, id, dto);
  }

  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.markAsRead(orgId, id);
  }

  // ---------- Messages ----------

  @Get('conversations/:id/messages')
  listMessages(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listMessages(
      orgId,
      id,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post('messages')
  sendOutbound(
    @CurrentOrg() orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: SendOutboundDto,
  ) {
    return this.service.sendOutbound(orgId, userId, dto);
  }

  // ---------- SSE stream (real-time inbox) ----------

  @Public()
  @Get('stream')
  async stream(
    @Query('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!token) throw new UnauthorizedException('Missing token');

    let payload: { sub: string; orgId: string };
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
    if (!payload.orgId) throw new UnauthorizedException('Missing orgId in token');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);
    this.publisher.register(payload.orgId, res);

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
