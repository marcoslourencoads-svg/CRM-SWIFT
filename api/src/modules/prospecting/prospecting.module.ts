import { Module } from '@nestjs/common';
import { ProspectsController } from './prospects.controller';
import { ProspectsService } from './prospects.service';
import { ProspectListsController, ProspectApproachesController } from './prospect-lists.controller';
import { ProspectListsService } from './prospect-lists.service';
import { ProspectingAnalyticsController } from './prospecting-analytics.controller';
import { ProspectingAnalyticsService } from './prospecting-analytics.service';
import { ProspectImportService } from './prospect-import.service';

@Module({
  controllers: [
    ProspectsController,
    ProspectListsController,
    ProspectApproachesController,
    ProspectingAnalyticsController,
  ],
  providers: [
    ProspectsService,
    ProspectListsService,
    ProspectingAnalyticsService,
    ProspectImportService,
  ],
  exports: [ProspectsService, ProspectListsService],
})
export class ProspectingModule {}
