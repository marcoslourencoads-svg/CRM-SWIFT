import { Module } from '@nestjs/common';
import { MetaAdsReportsController } from './meta-ads-reports.controller';
import { MetaAdsReportsService } from './meta-ads-reports.service';
import { TokenCryptoService } from './services/token-crypto.service';
import { MetaGraphService } from './services/meta-graph.service';
import { ReportBuilderService } from './services/report-builder.service';
import { ReportDispatcherService } from './services/report-dispatcher.service';
import { DailyReportScheduler } from './schedulers/daily-report.scheduler';

@Module({
  controllers: [MetaAdsReportsController],
  providers: [
    MetaAdsReportsService,
    TokenCryptoService,
    MetaGraphService,
    ReportBuilderService,
    ReportDispatcherService,
    DailyReportScheduler,
  ],
  exports: [MetaAdsReportsService],
})
export class MetaAdsReportsModule {}
