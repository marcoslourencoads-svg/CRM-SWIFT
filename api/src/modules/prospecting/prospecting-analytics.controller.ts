import { Controller, Get, Query } from '@nestjs/common';
import { ProspectChannel } from '@prisma/client';
import { ProspectingAnalyticsService } from './prospecting-analytics.service';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('prospecting')
@Roles('MANAGER')
export class ProspectingAnalyticsController {
  constructor(private readonly service: ProspectingAnalyticsService) {}

  @Get('funnel')
  getFunnel(
    @CurrentOrg() orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('listId') listId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('channel') channel?: ProspectChannel,
    @Query('hasAds') hasAds?: string,
    @Query('niche') niche?: string,
  ) {
    return this.service.getFunnel(orgId, {
      from,
      to,
      listId,
      ownerId,
      channel,
      niche,
      ...(hasAds !== undefined ? { hasAds: hasAds === 'true' } : {}),
    });
  }

  @Get('analytics')
  getAnalytics(
    @CurrentOrg() orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('listId') listId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('channel') channel?: ProspectChannel,
    @Query('hasAds') hasAds?: string,
    @Query('niche') niche?: string,
  ) {
    return this.service.getAnalytics(orgId, {
      from,
      to,
      listId,
      ownerId,
      channel,
      niche,
      ...(hasAds !== undefined ? { hasAds: hasAds === 'true' } : {}),
    });
  }
}
