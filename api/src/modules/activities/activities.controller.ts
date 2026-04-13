import { Controller, Get, Param, Query } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';

@Controller()
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get('leads/:leadId/activities')
  getByLead(
    @CurrentOrg() orgId: string,
    @Param('leadId') leadId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getByLead(
      orgId,
      leadId,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
