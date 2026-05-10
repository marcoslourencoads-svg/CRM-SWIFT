import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { ImportExportService } from './import-export.service';
import { ImportExportController } from './import-export.controller';
import { StaleLeadsDetectorScheduler } from './schedulers/stale-detector.scheduler';

@Module({
  controllers: [LeadsController, ImportExportController],
  providers: [LeadsService, ImportExportService, StaleLeadsDetectorScheduler],
  exports: [LeadsService],
})
export class LeadsModule {}
