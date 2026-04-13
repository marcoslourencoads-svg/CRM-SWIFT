import { Module } from '@nestjs/common';
import { LeadTasksService } from './lead-tasks.service';
import { LeadTasksController } from './lead-tasks.controller';

@Module({
  controllers: [LeadTasksController],
  providers: [LeadTasksService],
  exports: [LeadTasksService],
})
export class LeadTasksModule {}
