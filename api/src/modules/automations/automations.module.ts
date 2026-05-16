import { Module } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { AutomationsController } from './automations.controller';
import { TagsModule } from '../tags/tags.module';
import { NotesModule } from '../notes/notes.module';
import { LeadTasksModule } from '../lead-tasks/lead-tasks.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';

@Module({
  imports: [TagsModule, NotesModule, LeadTasksModule, WebhooksModule, CustomFieldsModule],
  controllers: [AutomationsController],
  providers: [AutomationsService],
  exports: [AutomationsService],
})
export class AutomationsModule {}
