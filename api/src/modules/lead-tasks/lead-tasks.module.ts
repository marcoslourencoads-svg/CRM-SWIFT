import { Module } from '@nestjs/common';
import { LeadTasksService } from './lead-tasks.service';
import { LeadTasksController } from './lead-tasks.controller';
import { TaskReminderScheduler } from './schedulers/task-reminder.scheduler';

@Module({
  controllers: [LeadTasksController],
  providers: [LeadTasksService, TaskReminderScheduler],
  exports: [LeadTasksService],
})
export class LeadTasksModule {}
