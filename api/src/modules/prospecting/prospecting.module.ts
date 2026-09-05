import { Module } from '@nestjs/common';
import { ProspectsController } from './prospects.controller';
import { ProspectsService } from './prospects.service';
import {
  ProspectListsController,
  ProspectApproachesController,
  ProspectNotesController,
} from './prospect-lists.controller';
import { ProspectListsService } from './prospect-lists.service';
import { ProspectingAnalyticsController } from './prospecting-analytics.controller';
import { ProspectingAnalyticsService } from './prospecting-analytics.service';
import { ProspectImportService } from './prospect-import.service';
import { ProspectReminderScheduler } from './schedulers/prospect-reminder.scheduler';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [
    ProspectsController,
    ProspectListsController,
    ProspectApproachesController,
    ProspectNotesController,
    ProspectingAnalyticsController,
  ],
  providers: [
    ProspectsService,
    ProspectListsService,
    ProspectingAnalyticsService,
    ProspectImportService,
    ProspectReminderScheduler,
  ],
  exports: [ProspectsService, ProspectListsService],
})
export class ProspectingModule {}
