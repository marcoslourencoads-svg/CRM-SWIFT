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
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { MoveLeadDto } from './dto/move-lead.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { BulkMoveDto, BulkAssignDto, BulkDeleteDto } from './dto/bulk-action.dto';
import { CurrentOrg, CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class LeadsController {
  constructor(private readonly service: LeadsService) {}

  @Post('pipelines/:pipelineId/leads')
  create(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('pipelineId') pipelineId: string,
    @Body() dto: CreateLeadDto,
  ) {
    dto.pipelineId = pipelineId;
    return this.service.create(orgId, user.sub, dto);
  }

  @Get('pipelines/:pipelineId/leads')
  findByPipeline(
    @CurrentOrg() orgId: string,
    @Param('pipelineId') pipelineId: string,
    @Query('statusId') statusId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('search') search?: string,
    @Query('temperature') temperature?: string,
    @Query('tagIds') tagIds?: string,
    @Query('createdAfter') createdAfter?: string,
    @Query('createdBefore') createdBefore?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.service.findByPipeline(orgId, pipelineId, {
      statusId,
      assigneeId,
      search,
      temperature,
      tagIds: tagIds ? tagIds.split(',').filter(Boolean) : undefined,
      createdAfter,
      createdBefore,
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }

  @Get('leads/:id')
  findOne(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.findOne(orgId, id);
  }

  // Bulk routes precisam vir ANTES das rotas com :id, senão "bulk" vira o id.
  @Patch('leads/bulk/move')
  bulkMove(@CurrentOrg() orgId: string, @Body() dto: BulkMoveDto) {
    return this.service.bulkMove(orgId, dto);
  }

  @Patch('leads/bulk/assign')
  bulkAssign(@CurrentOrg() orgId: string, @Body() dto: BulkAssignDto) {
    return this.service.bulkAssign(orgId, dto);
  }

  @Patch('leads/bulk/delete')
  bulkDelete(@CurrentOrg() orgId: string, @Body() dto: BulkDeleteDto) {
    return this.service.bulkDelete(orgId, dto);
  }

  @Patch('leads/:id')
  update(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.service.update(orgId, user.sub, id, dto);
  }

  @Patch('leads/:id/move')
  move(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: MoveLeadDto,
  ) {
    return this.service.move(orgId, user.sub, id, dto);
  }

  @Patch('leads/:id/assign')
  assign(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AssignLeadDto,
  ) {
    return this.service.assign(orgId, user.sub, id, dto);
  }

  @Delete('leads/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.service.remove(orgId, user.sub, id);
  }
}
