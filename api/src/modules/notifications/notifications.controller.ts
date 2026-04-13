import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

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
