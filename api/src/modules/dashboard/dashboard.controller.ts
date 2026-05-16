import { Controller, Get, Param, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('dashboard')
@Roles('MANAGER')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('kpis')
  getKpis(
    @CurrentOrg() orgId: string,
    @Query('pipelineId') pipelineId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.getKpis(orgId, pipelineId, dateFrom, dateTo);
  }

  @Get('cpl')
  getCpl(
    @CurrentOrg() orgId: string,
    @Query('month') month?: string,
  ) {
    return this.service.getCpl(orgId, month);
  }

  @Get('funnel/:pipelineId')
  getFunnel(
    @CurrentOrg() orgId: string,
    @Param('pipelineId') pipelineId: string,
  ) {
    return this.service.getFunnel(orgId, pipelineId);
  }

  @Get('insights')
  getInsights(
    @CurrentOrg() orgId: string,
    @Query('pipelineId') pipelineId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.insights(orgId, pipelineId, dateFrom, dateTo);
  }
}
