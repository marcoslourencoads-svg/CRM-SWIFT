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
import { PipelinesService } from './pipelines.service';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { UpdatePipelineDto } from './dto/update-pipeline.dto';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ReorderStatusesDto } from './dto/reorder-statuses.dto';
import { CreateTransitionRuleDto } from './dto/create-transition-rule.dto';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('pipelines')
export class PipelinesController {
  constructor(private readonly service: PipelinesService) {}

  // ─── Pipelines ──────────────────────────────────────────

  @Post()
  @Roles('ADMIN')
  create(@CurrentOrg() orgId: string, @Body() dto: CreatePipelineDto) {
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
    @Body() dto: UpdatePipelineDto,
  ) {
    return this.service.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.remove(orgId, id);
  }

  // ─── Statuses ───────────────────────────────────────────

  @Post(':pipelineId/statuses')
  @Roles('ADMIN')
  createStatus(
    @CurrentOrg() orgId: string,
    @Param('pipelineId') pipelineId: string,
    @Body() dto: CreateStatusDto,
  ) {
    return this.service.createStatus(orgId, pipelineId, dto);
  }

  @Patch('statuses/:statusId')
  @Roles('ADMIN')
  updateStatus(
    @CurrentOrg() orgId: string,
    @Param('statusId') statusId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.service.updateStatus(orgId, statusId, dto);
  }

  @Delete('statuses/:statusId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteStatus(
    @CurrentOrg() orgId: string,
    @Param('statusId') statusId: string,
  ) {
    return this.service.deleteStatus(orgId, statusId);
  }

  @Patch(':pipelineId/statuses/reorder')
  @Roles('ADMIN')
  reorderStatuses(
    @CurrentOrg() orgId: string,
    @Param('pipelineId') pipelineId: string,
    @Body() dto: ReorderStatusesDto,
  ) {
    return this.service.reorderStatuses(orgId, pipelineId, dto);
  }

  // ─── Transition Rules ───────────────────────────────────

  @Post(':pipelineId/transition-rules')
  @Roles('ADMIN')
  createTransitionRule(
    @CurrentOrg() orgId: string,
    @Param('pipelineId') pipelineId: string,
    @Body() dto: CreateTransitionRuleDto,
  ) {
    return this.service.createTransitionRule(orgId, pipelineId, dto);
  }

  @Get(':pipelineId/transition-rules')
  getTransitionRules(
    @CurrentOrg() orgId: string,
    @Param('pipelineId') pipelineId: string,
  ) {
    return this.service.getTransitionRules(orgId, pipelineId);
  }

  @Delete('transition-rules/:ruleId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTransitionRule(
    @CurrentOrg() orgId: string,
    @Param('ruleId') ruleId: string,
  ) {
    return this.service.deleteTransitionRule(orgId, ruleId);
  }
}
