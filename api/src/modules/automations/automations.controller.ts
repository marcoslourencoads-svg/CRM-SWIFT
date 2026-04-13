import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('automations')
export class AutomationsController {
  constructor(private readonly service: AutomationsService) {}

  @Post()
  @Roles('ADMIN')
  create(@CurrentOrg() orgId: string, @Body() dto: CreateAutomationDto) {
    return this.service.create(orgId, dto);
  }

  @Get()
  findAll(@CurrentOrg() orgId: string) {
    return this.service.findAll(orgId);
  }

  @Get(':id')
  findOne(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.findOne(orgId, id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    return this.service.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.remove(orgId, id);
  }

  @Get(':id/logs')
  findLogs(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.service.findLogs(
      orgId,
      id,
      limit ? parseInt(limit, 10) : undefined,
      cursor,
    );
  }

  @Post(':id/preview')
  @Roles('ADMIN')
  preview(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.preview(orgId, id);
  }
}
