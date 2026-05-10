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
} from '@nestjs/common';
import { MetaAdsReportsService } from './meta-ads-reports.service';
import { CreateMetaAccountDto } from './dto/create-meta-account.dto';
import { UpdateMetaAccountDto } from './dto/update-meta-account.dto';
import { GenerateReportDto } from './dto/generate-report.dto';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('meta-ads')
export class MetaAdsReportsController {
  constructor(private readonly service: MetaAdsReportsService) {}

  @Get('accounts')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  list(@CurrentOrg() orgId: string) {
    return this.service.findAll(orgId);
  }

  @Get('accounts/:id')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  findOne(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.findOne(orgId, id);
  }

  @Post('accounts')
  @Roles('ADMIN', 'OWNER')
  create(@CurrentOrg() orgId: string, @Body() dto: CreateMetaAccountDto) {
    return this.service.create(orgId, dto);
  }

  @Patch('accounts/:id')
  @Roles('ADMIN', 'OWNER')
  update(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMetaAccountDto,
  ) {
    return this.service.update(orgId, id, dto);
  }

  @Delete('accounts/:id')
  @Roles('ADMIN', 'OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.remove(orgId, id);
  }

  @Get('accounts/:id/reports')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  reports(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listReports(
      orgId,
      id,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post('accounts/:id/generate')
  @Roles('ADMIN', 'OWNER', 'MANAGER')
  generate(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: GenerateReportDto,
    @Query('send') send?: string,
  ) {
    return this.service.generate(orgId, id, dto.datePreset ?? 'yesterday', {
      send: send !== 'false',
    });
  }
}
