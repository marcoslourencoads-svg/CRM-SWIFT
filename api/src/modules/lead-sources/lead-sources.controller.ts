import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LeadSourcesService } from './lead-sources.service';
import { CreateLeadSourceDto } from './dto/create-lead-source.dto';
import { UpdateLeadSourceDto } from './dto/update-lead-source.dto';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('lead-sources')
export class LeadSourcesController {
  constructor(private readonly service: LeadSourcesService) {}

  @Get()
  findAll(@CurrentOrg() orgId: string) {
    return this.service.findAll(orgId);
  }

  @Get('report')
  report(@CurrentOrg() orgId: string) {
    return this.service.report(orgId);
  }

  @Post()
  @Roles('ADMIN')
  create(@CurrentOrg() orgId: string, @Body() dto: CreateLeadSourceDto) {
    return this.service.create(orgId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeadSourceDto,
  ) {
    return this.service.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.remove(orgId, id);
  }
}
