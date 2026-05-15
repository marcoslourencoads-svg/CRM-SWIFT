import { Controller, Get, Param, Query } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

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

  /**
   * Audit log da org inteira (admin only).
   * Filtros: userId, type, dateFrom, dateTo. Paginação por cursor.
   */
  @Get('activities')
  @Roles('ADMIN')
  list(
    @CurrentOrg() orgId: string,
    @Query('userId') userId?: string,
    @Query('type') type?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listForOrg(orgId, {
      userId,
      type,
      dateFrom,
      dateTo,
      cursor,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }
}
