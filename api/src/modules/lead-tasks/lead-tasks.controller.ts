import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { LeadTasksService } from './lead-tasks.service';
import { CreateLeadTaskDto } from './dto/create-lead-task.dto';
import { UpdateLeadTaskDto } from './dto/update-lead-task.dto';
import { CurrentUser, CurrentOrg } from '../../common/decorators/current-user.decorator';

@Controller()
export class LeadTasksController {
  constructor(private readonly service: LeadTasksService) {}

  @Get('leads/:leadId/tasks')
  findByLead(@Param('leadId') leadId: string) {
    return this.service.findByLead(leadId);
  }

  @Get('tasks/mine')
  findMine(
    @CurrentUser('sub') userId: string,
    @Query('status') status?: string,
  ) {
    return this.service.findMine(userId, status);
  }

  @Get('tasks')
  findForOrg(
    @CurrentOrg() orgId: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('pipelineId') pipelineId?: string,
    @Query('status') status?: 'pending' | 'completed' | 'overdue',
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findForOrg(orgId, {
      assigneeId,
      pipelineId,
      status,
      type,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Post('leads/:leadId/tasks')
  create(
    @CurrentUser('sub') userId: string,
    @Param('leadId') leadId: string,
    @Body() dto: CreateLeadTaskDto,
  ) {
    return this.service.create(leadId, userId, dto);
  }

  @Patch('tasks/:id')
  update(@Param('id') id: string, @Body() dto: UpdateLeadTaskDto) {
    return this.service.update(id, dto);
  }

  @Patch('tasks/:id/complete')
  complete(@Param('id') id: string) {
    return this.service.complete(id);
  }
}
